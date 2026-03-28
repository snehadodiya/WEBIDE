import { useState, useRef, useEffect } from 'react';
import './Chat.css';

function Chat({ onExecuteCommand }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: '👋 Hello! I\'m your AI assistant. I can help you write code, debug issues, explain concepts, and answer programming questions. What would you like to work on?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message to server for processing
      console.log('Sending chat request to:', 'http://localhost:5000/chat');
      const response = await fetch('http://localhost:5000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: {
            currentFile: window.selectedFile,
            fileTree: window.fileTree
          }
        })
      });

      console.log('Chat response status:', response.status);
      console.log('Chat response headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Chat response data:', data);

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions
      };

      setMessages(prev => [...prev, botMessage]);

      // Execute any commands if specified
      if (data.actions && data.actions.length > 0) {
        data.actions.forEach(action => {
          if (action.type === 'command' && onExecuteCommand) {
            setTimeout(() => {
              onExecuteCommand(action.command);
            }, 1000);
          }
        });
      }

    } catch (error) {
      console.error('Chat request failed:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Sorry, I encountered an error: ${error.message}. Please check that the server is running on port 9000.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>🤖 GitHub Copilot</h3>
        <span className="chat-status">Online</span>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-avatar">
              {message.type === 'bot' ? '🤖' : '👤'}
            </div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">{formatTime(message.timestamp)}</div>
              {message.actions && message.actions.length > 0 && (
                <div className="message-actions">
                  {message.actions.map((action, index) => (
                    <button
                      key={index}
                      className="action-button"
                      onClick={() => {
                        if (action.type === 'command' && onExecuteCommand) {
                          onExecuteCommand(action.command);
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message bot">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="message-text typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <div className="chat-input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot anything about coding..."
            disabled={isLoading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="chat-send-button"
          >
            {isLoading ? '⏳' : '📤'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Chat;