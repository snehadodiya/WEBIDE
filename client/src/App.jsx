import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import "./components/Chat.css";
import Terminal from "./components/terminal";
import FileTree from "./components/tree";
import Chat from "./components/Chat";
import ConnectGitHub from "./components/ConnectGitHub";
import socket from "./socket";
import AceEditor from "react-ace";
import ace from "ace-builds";

import { getFileMode } from "./utils/getFileMode";
import { getRunCommand } from "./utils/getRunCommand";

ace.config.set("basePath", "/node_modules/ace-builds/src-noconflict/");

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '24px', 
          color: 'white', 
          backgroundColor: 'rgba(245, 87, 108, 0.1)',
          border: '2px solid rgba(245, 87, 108, 0.5)',
          borderRadius: '10px',
          margin: '20px',
          background: 'linear-gradient(135deg, rgba(245, 87, 108, 0.1) 0%, rgba(245, 87, 108, 0.05) 100%)',
          boxShadow: '0 8px 24px rgba(245, 87, 108, 0.2)'
        }}>
          <h2 style={{ marginBottom: '10px', fontSize: '20px' }}>❌ Something went wrong</h2>
          <p style={{ marginBottom: '16px', color: '#d0d0d0' }}>The application encountered an error. Please refresh the page to continue.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
          >
            🔄 Refresh Page
          </button>
          {import.meta.env.DEV && (
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', color: '#4facfe', fontWeight: '600', marginBottom: '8px' }}>📋 Error Details</summary>
              <pre style={{ color: '#cccccc', fontSize: '12px', marginTop: '10px', padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '6px', overflow: 'auto' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [fileTree, setFileTree] = useState({});
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedFileContent, setSelectedFileContent] = useState("");
  const [code, setCode] = useState("");
  const [hasConflict, setHasConflict] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showRepos, setShowRepos] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [githubError, setGithubError] = useState(null);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [terminalHeight, setTerminalHeight] = useState(300);
  const [showTerminal, setShowTerminal] = useState(true);

  const saveTimeout = useRef(null);

  const isSaved = selectedFile ? selectedFileContent === code : true;

  const handleCodeChange = (newCode) => {
    setCode(newCode);

    if (!selectedFile) return;

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    // Debounce to avoid rapid event bursts and avoid cross-file writes.
    saveTimeout.current = setTimeout(() => {
      if (!selectedFile) return;
      if (newCode !== selectedFileContent) {
        socket.emit("file:change", {
          path: selectedFile,
          content: newCode,
        });
        setSelectedFileContent(newCode);
      }
    }, 300);
  };

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFileContent("");
      setCode("");
      return;
    }

    const loadContent = async () => {
      const response = await fetch(`http://localhost:5000/files/content?path=${selectedFile}`);
      const result = await response.json();
      setSelectedFileContent(result.content);
      setCode(result.content);
      setHasConflict(result.content.includes('<<<<<<< HEAD'));
    };

    loadContent();
  }, [selectedFile]);

  const getFileTree = async () => {
    const response = await fetch("http://localhost:5000/files");
    const result = await response.json();
    setFileTree(result.tree);
  };

  const fetchGithubRepos = async () => {
    try {
      
      setGithubError(null);
      const response = await fetch("http://localhost:5000/github/repos", {
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || response.statusText);
      }
      const repos = await response.json();
      setGithubRepos(repos);
      setShowRepos(true);
      console.log("GitHub repos", repos);
    } catch (error) {
      setGithubError(error.message);
      console.error("Failed to fetch GitHub repos", error);
    }
  };

  const getFileContents = useCallback(async () => {
    if (!selectedFile) return;
    const response = await fetch(
      `http://localhost:5000/files/content?path=${selectedFile}`
    );
    const result = await response.json();

    setHasConflict(result.content.includes('<<<<<<< HEAD'));
    setSelectedFileContent(result.content);
    setCode(result.content);
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile) getFileContents();
  }, [getFileContents, selectedFile]);

  useEffect(() => {
    getFileTree();
  }, []);

  useEffect(() => {
    socket.on("file:refresh", getFileTree);
    return () => {
      socket.off("file:refresh", getFileTree);
    };
  }, []);

  // Make context available globally for chat
  useEffect(() => {
    window.selectedFile = selectedFile;
    window.fileTree = fileTree;
  }, [selectedFile, fileTree]);

  // Handle sidebar resize
  const handleSidebarMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(150, Math.min(500, startWidth + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle terminal resize
  const handleTerminalMouseDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (e) => {
      const diff = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + diff));
      setTerminalHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="playground-container">
      <div className="main-content">
        <div className="editor-container">
          <div 
            className="files" 
            style={{ width: `${sidebarWidth}px` }}
          >
            <FileTree
              onSelect={(path) => {
                setSelectedFile(path);
              }}
              onCreate={(path, isDir) => {
                socket.emit('file:create', { path, isDir });
              }}
              onDelete={(path) => {
                socket.emit('file:delete', { path });
                if (path === selectedFile) {
                  setSelectedFile("");
                }
              }}
              tree={fileTree}
            />
          </div>
          <div 
            className="resize-handle-vertical" 
            onMouseDown={handleSidebarMouseDown}
            title="Drag to resize file panel"
          />
          <div className="editor">
            <div className="editor-header">
              <span className="file-status">
                {selectedFile ? selectedFile.replaceAll("/", " > ") : "No file selected"}
              </span>
              <div className="header-actions">
                <button
                  className="run-button"
                  onClick={() => {
                    const command = getRunCommand({ selectedFile });
                    if (command) {
                      socket.emit('terminal:write', command + '\r');
                    }
                  }}
                  disabled={!selectedFile}
                  title="Run the selected file"
                >
                  ▶ Run Code
                </button>
                <div className="github-dropdown">
                  <button className="git-button github-main-btn">
                    🐙 GitHub ▼
                  </button>
                  <div className="github-dropdown-content">
                    <button
                      className="git-button"
                      onClick={() => {
                        const repo = prompt("Repository URL:");
                        if (repo) {
                          socket.emit('terminal:write', `git clone ${repo}\r\n`);
                        }
                      }}
                    >
                      📥 Clone
                    </button>
                    <button
                      className="git-button"
                      onClick={() => {
                        socket.emit('terminal:write', 'git add .\r\n');
                      }}
                    >
                      ➕ Add
                    </button>
                    <button
                      className="git-button"
                      onClick={() => {
                        const message = prompt("Commit message:");
                        if (message) {
                          socket.emit('terminal:write', `git commit -m "${message}"\r\n`);
                        }
                      }}
                    >
                      💾 Commit
                    </button>
                    <button
                      className="git-button"
                      onClick={() => {
                        // Push with token authentication
                        fetch("http://localhost:5000/github/push", {
                          method: "POST",
                          credentials: "include",
                        }).then(response => {
                          if (!response.ok) {
                            // Fallback to regular push
                            socket.emit('terminal:write', 'git push origin main\r\n');
                          }
                        }).catch(() => {
                          // Fallback to regular push
                          socket.emit('terminal:write', 'git push origin main\r\n');
                        });
                      }}
                      title="Push code to GitHub using stored access token"
                    >
                      ⬆️ Push
                    </button>
                    <button
                      className="git-button"
                      onClick={() => {
                        const branch = prompt("Branch name:");
                        if (branch) {
                          const isNew = confirm("Create new branch if it doesn't exist?");
                          const command = isNew ? `git checkout -b ${branch}\r\n` : `git checkout ${branch}\r\n`;
                          socket.emit('terminal:write', command);
                        }
                      }}
                    >
                      🌿 Branch Change
                    </button>
                    <ConnectGitHub />
                    <button
                      className="git-button"
                      onClick={fetchGithubRepos}
                      title="Fetch repositories using the stored GitHub access token"
                    >
                      📂 My Repos
                    </button>
                  </div>
                </div>
                <button
                  className="chat-toggle-button"
                  onClick={() => setShowChat(prev => !prev)}
                >
                  💬 Chat
                </button>
                {hasConflict && (
                  <>
                    <button
                      className="git-button"
                      onClick={() => {
                        // Choose previous (HEAD)
                        const lines = code.split('\n');
                        const newLines = [];
                        let inConflict = false;
                        for (const line of lines) {
                          if (line.startsWith('<<<<<<< HEAD')) {
                            inConflict = true;
                          } else if (line.startsWith('=======')) {
                            inConflict = false;
                          } else if (line.startsWith('>>>>>>> ')) {
                            inConflict = false;
                          } else if (!inConflict) {
                            newLines.push(line);
                          }
                        }
                        setCode(newLines.join('\n'));
                        setHasConflict(false);
                      }}
                    >
                      Choose Previous
                    </button>
                    <button
                      className="git-button"
                      onClick={() => {
                        // Choose current (incoming)
                        const lines = code.split('\n');
                        const newLines = [];
                        let skip = false;
                        for (const line of lines) {
                          if (line.startsWith('<<<<<<< HEAD')) {
                            skip = true;
                          } else if (line.startsWith('=======')) {
                            skip = false;
                          } else if (line.startsWith('>>>>>>> ')) {
                            skip = false;
                          } else if (!skip) {
                            newLines.push(line);
                          }
                        }
                        setCode(newLines.join('\n'));
                        setHasConflict(false);
                      }}
                    >
                      Choose Current
                    </button>
                    
                  </>
                )}
                {selectedFile && (
                  <span className={`save-status ${!isSaved ? 'unsaved' : ''}`}>
                    {isSaved ? "Saved" : "Unsaved"}
                  </span>
                )}
              </div>
            </div>
            {(githubError || githubRepos.length > 0) && (
              <div className="github-status" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                {githubError ? (
                  <span style={{ color: 'var(--danger)' }}>GitHub error: {githubError}</span>
                ) : (
                  <span>Fetched {githubRepos.length} repo{githubRepos.length === 1 ? '' : 's'} from GitHub.</span>
                )}
              </div>
            )}
            <AceEditor
              width="100%"
              height="100%"
              mode={getFileMode({ selectedFile })}
              theme="monokai"
              value={code}
              onChange={handleCodeChange}
              fontSize={14}
              showPrintMargin={false}
              showGutter={true}
              highlightActiveLine={true}
              enableBasicAutocompletion={true}
              enableLiveAutocompletion={true}
              enableSnippets={true}
              showLineNumbers={true}
              tabSize={2}
            />
          </div>
        </div>
        {showTerminal && (
          <>
            <div 
              className="resize-handle-horizontal" 
              onMouseDown={handleTerminalMouseDown}
              title="Drag to resize terminal"
            />
            <div 
              className="terminal-container"
              style={{ height: `${terminalHeight}px` }}
            >
              <Terminal />
            </div>
          </>
        )}
        <button 
          className="toggle-terminal-button"
          onClick={() => setShowTerminal(!showTerminal)}
          title={showTerminal ? "Hide terminal" : "Show terminal"}
        >
          {showTerminal ? "▼ Terminal" : "▶ Terminal"}
        </button>
      </div>
      {showChat && (
        <div className="chat-sidebar">
          <Chat
            onExecuteCommand={(command) => {
              socket.emit('terminal:write', command + '\r\n');
            }}
          />
        </div>
      )}
      {showRepos && (
        <div className="repos-modal">
          <div className="repos-content">
            <h3>Your GitHub Repositories</h3>
            <div className="repos-list">
              {githubRepos.map((repo) => (
                <div key={repo.id} className="repo-item">
                  <div className="repo-header">
                    <h4 className="repo-name">{repo.name}</h4>
                    <span className="repo-visibility">{repo.private ? 'Private' : 'Public'}</span>
                  </div>
                  {repo.description && (
                    <p className="repo-description">{repo.description}</p>
                  )}
                  <div className="repo-stats">
                    <span className="repo-stat">
                      <span className="stat-icon">⭐</span>
                      {repo.stargazers_count}
                    </span>
                    <span className="repo-stat">
                      <span className="stat-icon">🍴</span>
                      {repo.forks_count}
                    </span>
                    <span className="repo-language">
                      {repo.language || 'No language'}
                    </span>
                  </div>
                  <div className="repo-actions">
                    <button
                      className="clone-button"
                      onClick={() => {
                        // Clone with token authentication
                        fetch("http://localhost:5000/github/clone-repo", {
                          method: "POST",
                          credentials: "include",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({ repoUrl: repo.clone_url }),
                        }).then(response => {
                          if (response.ok) {
                            setShowRepos(false);
                          } else {
                            // Fallback to regular clone
                            socket.emit('terminal:write', `git clone ${repo.clone_url}\r\n`);
                            setShowRepos(false);
                          }
                        }).catch(() => {
                          // Fallback to regular clone
                          socket.emit('terminal:write', `git clone ${repo.clone_url}\r\n`);
                          setShowRepos(false);
                        });
                      }}
                    >
                      Clone
                    </button>
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-button"
                    >
                      View on GitHub
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <div className="repos-actions">
              <button onClick={() => setShowRepos(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
    
  );
}

export { ErrorBoundary };
export default App;