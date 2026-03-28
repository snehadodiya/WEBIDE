export const getFileMode = ({ selectedFile }) => {
  if (!selectedFile) return "";
  const splitedArray = selectedFile.split(".");
  
  const extension = splitedArray[splitedArray.length - 1].toLowerCase();

  switch (extension) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "xml":
      return "xml";
    case "rb":
      return "ruby";
    case "sass":
    case "scss":
      return "sass";
    case "md":
      return "markdown";
    case "sql":
      return "sql";
    case "json":
      return "json";
    case "html":
      return "html";
    case "hbs":
    case "handlebars":
      return "handlebars";
    case "go":
      return "golang";
    case "cs":
      return "csharp";
    case "coffee":
    case "litcoffee":
      return "coffee";
    case "css":
      return "css";
    case "php":
      return "php";
    case "sh":
    case "bash":
      return "sh";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "text";
  }
};