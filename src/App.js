import React, { useState } from "react";
import "./App.css";
import ChatWindow from "./components/ChatWindow";

function App() {
  return (
    <div className="App">
      <div className="heading">
        <img src="/logo.png" alt="PartSelect" className="logo" />
        <span>PartSelect Assistant</span>
      </div>
      <ChatWindow/>
    </div>
  );
}

export default App;
