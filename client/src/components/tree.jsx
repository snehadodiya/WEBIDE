import { useState } from "react";

// File type icons mapping
const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();

  const iconMap = {
    // Programming languages
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', py: '🐍', java: '☕',
    // Web files
    html: '🌐', css: '🎨', scss: '🎨', sass: '🎨', less: '🎨',
    // Images
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', ico: '🖼️',
    // Documents
    json: '📄', md: '📝', txt: '📄', xml: '📄', yaml: '📄', yml: '📄',
    // Archives
    zip: '📦', tar: '📦', gz: '📦', rar: '📦',
    // Config files
    config: '⚙️', conf: '⚙️', env: '⚙️', gitignore: '🚫',
    // Other
    pdf: '📕', mp4: '🎥', mp3: '🎵', wav: '🎵'
  };

  return iconMap[ext] || '📄';
};

const FileTreeNode = ({ fileName, nodes, onSelect, path, onCreate, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isDir = !!nodes;

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
      onDelete(path);
    }
  };

  const handleCreate = (e) => {
    e.stopPropagation();
    const name = prompt("Enter name:");
    if (!name) return;
    const isDirCreate = confirm("Create as directory? (OK for directory, Cancel for file)");
    onCreate(path + "/" + name, isDirCreate);
  };

  return (
    <div style={{ marginLeft: "10px" }}>
      <div
        className="file-tree-item"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (isDir) {
            setIsExpanded(!isExpanded);
          } else {
            onSelect(path);
          }
        }}
      >
        <div className="file-tree-content">
          <span className="file-tree-icon">
            {isDir ? (isExpanded ? "📂" : "📁") : getFileIcon(fileName)}
          </span>
          <span className="file-tree-name">{fileName}</span>
        </div>
        <div className={`file-tree-actions ${showActions ? 'visible' : ''}`}>
          {isDir && (
            <button
              className="file-action-btn create-btn"
              onClick={handleCreate}
              title="Create new file/folder"
            >
              ➕
            </button>
          )}
          <button
            className="file-action-btn delete-btn"
            onClick={handleDelete}
            title="Delete this item"
          >
            🗑️
          </button>
        </div>
      </div>
      {isDir && isExpanded && fileName !== "node_modules" && (
        <ul>
          {Object.keys(nodes).map((child) => (
            <li key={child}>
              <FileTreeNode
                onSelect={onSelect}
                onCreate={onCreate}
                onDelete={onDelete}
                path={path + "/" + child}
                fileName={child}
                nodes={nodes[child]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FileTree = ({ tree, onSelect, onCreate, onDelete }) => {
  return <FileTreeNode onSelect={onSelect} onCreate={onCreate} onDelete={onDelete} fileName="/" path="" nodes={tree} />;
};
export default FileTree;