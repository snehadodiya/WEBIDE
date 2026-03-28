import React from "react";

export default function ConnectGitHub() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirectUri =
    import.meta.env.VITE_GITHUB_REDIRECT_URI ||
    "http://localhost:5000/auth/github/callback";

  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(
    clientId
  )}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return (
    
    <button
      className="git-button"
      onClick={() => {
        if (!clientId) {
          alert(
            "Missing GitHub client ID. Set VITE_GITHUB_CLIENT_ID in your .env file."
          );
          return;
        }

        window.location.href = oauthUrl;
      }}
    >
        
      Connect GitHub
    </button>
   
  );
}
