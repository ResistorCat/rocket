import React, { useState } from 'react';
import { Send, Paperclip, Mic } from 'lucide-react';
import './ChatInput.css';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <button className="icon-btn" aria-label="Adjuntar archivo">
        <Paperclip size={24} />
      </button>
      <div className="input-wrapper">
        <input 
          type="text" 
          placeholder="Mensaje" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          className="chat-input"
        />
      </div>
      {text.trim() ? (
        <button className="icon-btn send-btn" onClick={handleSend} aria-label="Enviar mensaje">
          <Send size={20} className="send-icon" />
        </button>
      ) : (
        <button className="icon-btn mic-btn" aria-label="Mensaje de voz">
          <Mic size={24} />
        </button>
      )}
    </div>
  );
}
