import React, { useState } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';
import './ChatInput.css';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSendMessage, isLoading = false }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  };

  return (
    <div className={`chat-input-container ${isLoading ? "loading" : ""}`}>
      <button className="icon-btn" aria-label="Adjuntar archivo" disabled={isLoading}>
        <Paperclip size={24} />
      </button>
      <div className="input-wrapper">
        <input 
          type="text" 
          placeholder={isLoading ? "Rocket está escribiendo..." : "Mensaje"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-input"
          disabled={isLoading}
        />
      </div>
      {text.trim() && !isLoading ? (
        <button className="icon-btn send-btn" onClick={handleSend} aria-label="Enviar mensaje" disabled={isLoading}>
          <Send size={20} className="send-icon" />
        </button>
      ) : (
        <button className="icon-btn mic-btn" aria-label="Mensaje de voz" disabled={isLoading}>
          <Mic size={24} />
        </button>
      )}
    </div>
  );
}
