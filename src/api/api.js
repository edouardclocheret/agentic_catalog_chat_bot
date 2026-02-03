const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

export const getAIMessage = async (userQuery, sessionId) => {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userQuery, sessionId })
  });

  const data = await res.json();

  return {
    role: "assistant",
    content: data.message,
    sessionId: data.sessionId,
    toolData: data.toolData
  };
};
