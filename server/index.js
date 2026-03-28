const http = require('http')
const express = require('express')
const session = require('express-session')
const fs = require('fs/promises')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const cors = require('cors')
const chokidar = require('chokidar');
const {GoogleGenerativeAI} = require('@google/generative-ai');
require('dotenv').config();
const axios = require('axios');

const pty = require('node-pty')
const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-in-production'

let ptyProcess;

try {
  ptyProcess = pty.spawn("docker", ["exec", "-it", "web-container", "bash"], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    // cwd: process.cwd(),
    cwd: process.env.INIT_CWD + '/user',
    env: process.env
  });
  console.log('Terminal attached to Docker container web-container');
} catch (dockerError) {
  console.warn('Docker terminal failed, falling back to local shell:', dockerError.message);
  const shellProgram = process.platform === 'win32' ? 'powershell.exe' : 'bash';
  ptyProcess = pty.spawn(shellProgram, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env
  });
  console.log(`Terminal attached to local shell ${shellProgram}`);
}

const app = express()
const server = http.createServer(app);
const io = new SocketServer({
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
})

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
)

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    },
  })
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


app.use(express.json())

io.attach(server);

chokidar.watch('./user').on('all', (event, path) => {
    io.emit('file:refresh', path)
});

ptyProcess.onData(data => {
    io.emit('terminal:data', data)
})

ptyProcess.onExit(({ exitCode, signal }) => {
    console.warn(`PTY process exited with code ${exitCode} and signal ${signal}`);
});

io.on('connection', (socket) => {
    console.log(`Socket connected`, socket.id)

    socket.emit('file:refresh')
    socket.emit('terminal:data', 'Welcome to terminal\r\n$ ')

    socket.on('file:change', async ({ path, content }) => {
        try {
            await fs.writeFile(`./user${path}`, content);
            socket.emit('file:change:success', { path });
            console.log('File changed:', path);
        } catch (error) {
            socket.emit('file:change:error', { path, error: error.message });
            console.error('Error changing file:', error);
        }
    })

    socket.on('file:create', async ({ path, isDir }) => {
        try {
            const fullPath = `./user${path}`;
            if (isDir) {
                await fs.mkdir(fullPath, { recursive: true });
            } else {
                await fs.writeFile(fullPath, '');
            }
            socket.emit('file:create:success', { path, isDir });
            console.log('File created:', path);
        } catch (error) {
            socket.emit('file:create:error', { path, error: error.message });
            console.error('Error creating file:', error);
        }
    })

    socket.on('file:delete', async ({ path }) => {
        try {
            const fullPath = `./user${path}`;
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
                await fs.rmdir(fullPath, { recursive: true });
            } else {
                await fs.unlink(fullPath);
            }
            socket.emit('file:delete:success', { path });
            console.log('File deleted:', path);
        } catch (error) {
            socket.emit('file:delete:error', { path, error: error.message });
            console.error('Error deleting file:', error);
        }
    })

    socket.on('terminal:write', (data) => {
        try {
            if (ptyProcess && ptyProcess.write) {
                ptyProcess.write(data);
                console.log('Terminal write:', data);
            }
        } catch (error) {
            console.error('Error writing to terminal:', error);
            socket.emit('terminal:error', { error: error.message });
        }
    })
})

app.get('/files', async (req, res) => {
    const fileTree = await generateFileTree('./user');
    return res.json({ tree: fileTree })
})

app.get('/files/content', async (req, res) => {
    const path = req.query.path;
    const content = await fs.readFile(`./user${path}`, 'utf-8')
    return res.json({ content })
})


app.get("/auth/github/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Missing code in callback");
  }

  try {
    // DEBUG: Log the values used for exchange (mask secret)
    console.log("GitHub OAuth exchange", {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET ? "***" : null,
      code,
    });

    const response = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );

    const access_token = response.data.access_token;
    if (!access_token) {
      return res.status(500).json({ error: 'No access token returned from GitHub', details: response.data });
    }

    // Store in session (temporary storage)
    req.session.githubAccessToken = access_token;
    console.log("GitHub Token stored in session");

    // Redirect back to the frontend so the user can continue using the IDE
    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(redirectUrl + "/?github=connected");
  } catch (error) {
    console.error('GitHub OAuth callback failed', error?.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to exchange OAuth code for token', details: error?.response?.data || error.message });
  }
});

app.get('/github/repos', async (req, res) => {
  const accessToken = req.session?.githubAccessToken;
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }

  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const user = response.data;
    req.session.githubUser = user;

    // Configure Git credentials in the container
    const gitCommands = [
      `git config --global user.name "${user.name || user.login}"`,
      `git config --global user.email "${user.email || `${user.login}@users.noreply.github.com`}"`,
      `git config --global credential.helper store`,
      `echo "https://${user.login}:${accessToken}@github.com" > ~/.git-credentials`,
      `chmod 600 ~/.git-credentials`
    ];

    // Execute Git configuration commands in the container
    gitCommands.forEach(cmd => {
      ptyProcess.write(cmd + '\r\n');
    });

    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
      params: {
        per_page: 100,
      },
    });

    return res.json(reposResponse.data);
  } catch (error) {
    console.error('Failed to fetch GitHub repos', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to fetch GitHub repositories',
      details: error?.response?.data || error.message,
    });
  }
});

// Clone repository with token authentication
app.post('/github/clone-repo', async (req, res) => {
  const accessToken = req.session?.githubAccessToken;
  const user = req.session?.githubUser;
  const { repoUrl } = req.body;

  if (!accessToken || !user) {
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }

  if (!repoUrl) {
    return res.status(400).json({ error: 'Repository URL is required' });
  }

  try {
    // Extract repo name from URL
    const repoName = repoUrl.replace('https://github.com/', '').replace('.git', '');
    const tokenUrl = `https://${user.login}:${accessToken}@github.com/${repoName}.git`;

    ptyProcess.write(`git clone ${tokenUrl}\r\n`);

    return res.json({ success: true, message: 'Repository clone initiated' });
  } catch (error) {
    console.error('Failed to clone repository', error.message);
    return res.status(500).json({
      error: 'Failed to clone repository',
      details: error.message,
    });
  }
});

// Push to repository with token authentication
app.post('/github/push', async (req, res) => {
  const accessToken = req.session?.githubAccessToken;
  const user = req.session?.githubUser;

  if (!accessToken || !user) {
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }

  try {
    // Get current branch
    ptyProcess.write('git rev-parse --abbrev-ref HEAD\r\n');
    // Note: In a real implementation, we'd need to capture the output, but for simplicity, assume main or handle in client
    // For now, push to origin HEAD to push current branch
    ptyProcess.write('git push origin HEAD\r\n');

    return res.json({ success: true, message: 'Push initiated' });
  } catch (error) {
    console.error('Failed to push repository', error.message);
    return res.status(500).json({
      error: 'Failed to push repository',
      details: error.message,
    });
  }
});

// Configure Git remote with token authentication
app.post('/github/setup-remote', async (req, res) => {
  const accessToken = req.session?.githubAccessToken;
  const user = req.session?.githubUser;
  const { repoName } = req.body;

  if (!accessToken || !user) {
    return res.status(401).json({ error: 'Not authenticated with GitHub' });
  }

  if (!repoName) {
    return res.status(400).json({ error: 'Repository name is required' });
  }

  try {
    // Set up remote with token in URL
    const remoteUrl = `https://${user.login}:${accessToken}@github.com/${repoName}.git`;
    const commands = [
      `git remote remove origin 2>/dev/null; true`,
      `git remote add origin ${remoteUrl}`
    ];

    commands.forEach(cmd => {
      ptyProcess.write(cmd + '\r\n');
    });

    return res.json({ success: true, message: 'Remote configured with token authentication' });
  } catch (error) {
    console.error('Failed to setup Git remote', error.message);
    return res.status(500).json({
      error: 'Failed to configure Git remote',
      details: error.message,
    });
  }
});

// Chat endpoint

app.post('/chat', async (req, res) => {
    const { message, context } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
You are an AI coding assistant inside a web IDE.

User message: ${message}

Current file: ${context?.currentFile || "None"}
Project structure: ${JSON.stringify(context?.fileTree || {})}

Give helpful coding response.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({
            response: text,
            actions: []
        });

    } catch (error) {
        console.error("Gemini Error:", error);

        res.status(500).json({
            response: `Error: ${error.message}`,
            actions: []
        });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));


async function generateFileTree(directory) {
    const tree = {}

    async function buildTree(currentDir, currentTree) {
        const files = await fs.readdir(currentDir)

        for (const file of files) {
            const filePath = path.join(currentDir, file)
            const stat = await fs.stat(filePath)

            if (stat.isDirectory()) {
                currentTree[file] = {}
                await buildTree(filePath, currentTree[file])
            } else {
                currentTree[file] = null
            }
        }
    }

    await buildTree(directory, tree);
    return tree
}