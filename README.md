# Web Code Editor

A web-based code editor with file explorer, code editor, and integrated terminal.

## Features

- File tree explorer with expandable directories
- Code editor with syntax highlighting for multiple languages
- Integrated terminal running in Docker container
- Auto-save functionality
- Real-time file synchronization

## Setup

1. Install dependencies:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```

1.5. Configure GitHub OAuth (required for GitHub integration):
   - Copy `server/.env.example` to `server/.env` and fill `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.
   - Copy `client/.env.example` to `client/.env` and set `VITE_GITHUB_CLIENT_ID`.

2. Build and run Docker container:
   ```bash
   cd server
   docker build -t web-ide .
   docker run -d -it --name web-container -v $(pwd)/user:/workspace web-ide
   ```

3. Start the server:
   ```bash
   cd server && npm start
   ```

4. Start the client:
   ```bash
   cd client && npm run dev
   ```

5. Open http://localhost:5173 in your browser.

## Usage

- Click on files in the file tree to open them in the editor
- Edit code with syntax highlighting
- Changes are auto-saved after 5 seconds
- Use the terminal to run commands in the container
- Files are synced between the editor and the container via mounted volume

## Supported Languages

JavaScript, TypeScript, Python, Java, HTML, CSS, JSON, Markdown, and more.