export const getRunCommand = ({ selectedFile }) => {
  if (!selectedFile) return "";
  const fileName = selectedFile.startsWith('/') ? selectedFile.slice(1) : selectedFile;
  const extension = fileName.split('.').pop().toLowerCase();

  switch (extension) {
    case "js":
      return `node ${fileName}`;
    case "py":
      return `python3 ${fileName}`;
    case "html":
      return `echo "Open ${fileName} in browser"`;
    case "sh":
      return `bash ${fileName}`;
    case "java":
      // Assuming compiled, but for simplicity
      return `java ${fileName.replace('.java', '')}`;
    default:
      return `echo "Cannot run ${fileName}"`;
  }
};