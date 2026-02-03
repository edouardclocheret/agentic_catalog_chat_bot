import React, { useState, useEffect, useRef } from "react";
import "./ChatWindow.css";
import { getAIMessage } from "../api/api";
import { marked } from "marked";

function ChatWindow() {

  const defaultMessage = [{
    role: "assistant",
    content: "Hi, how can I help you today?"
  }];

  const [messages,setMessages] = useState(defaultMessage)
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
      scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText) => {
    if (messageText && messageText.trim() !== "") {
      // Set user message
      setMessages(prevMessages => [...prevMessages, { role: "user", content: messageText }]);
      setInput("");

      // Call API & set assistant message
      const newMessage = await getAIMessage(messageText, sessionId);
      
      // Store sessionId from response for next request
      if (newMessage.sessionId) {
        setSessionId(newMessage.sessionId);
      }
      
      console.log("New message received:", newMessage);
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
    }
  };

  return (
      <div className="messages-container">
          {messages.map((message, index) => (
              <div key={index} className={`${message.role}-message-container`}>
                  {message.content && (
                      <div className={`message ${message.role}-message`}>
                          <div dangerouslySetInnerHTML={{__html: marked(message.content).replace(/<p>|<\/p>/g, "")}}></div>
                      </div>
                  )}
                  {message.role === "assistant" && message.toolData && (
                      <div className="tool-badge">
                          <span className="checkmark">✓</span>
                          <span className="tool-text">
                              APPROVED by PartSelect{" "}
                              {message.toolData.toolName === "diagnose_repair" && "Diagnosis Tool"}
                              {message.toolData.toolName === "check_compatibility" && "Compatibility Tool"}
                              {message.toolData.toolName === "get_installation_instructions" && "Installation Tool"}
                          </span>
                      </div>
                  )}
                  {message.role === "assistant" && message.toolData && message.toolData.toolName === "get_installation_instructions" && message.toolData.data?.videoUrl && (
                      <div className="video-bubble">
                          <iframe
                              width="100%"
                              height="315"
                              src={message.toolData.data.videoUrl}
                              title={message.toolData.data.name || "Installation Video"}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                          ></iframe>
                          <p className="video-title">{message.toolData.data.name}</p>
                      </div>
                  )}
                  {message.role === "assistant" && message.toolData && message.toolData.toolName === "diagnose_repair" && message.toolData.data?.suggestedParts && (
                      <div className="parts-grid">
                          {message.toolData.data.suggestedParts.map((part, partIndex) => (
                              <div key={partIndex} className="part-card">
                                  {part.image_url && (
                                      <img src={part.image_url} alt={part.name} className="part-image" />
                                  )}
                                  <h3 className="part-name">{part.name}</h3>
                                  <p className="part-number">Part #: {part.partNumber}</p>
                                  <p className="part-price">${part.price?.toFixed(2)}</p>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
          <div ref={messagesEndRef} />
          <div className="input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  handleSend(input);
                  e.preventDefault();
                }
              }}
              rows="3"
            />
            <button className="send-button" onClick={() => handleSend(input)}>
              Send
            </button>
          </div>
      </div>
);
}

export default ChatWindow;
