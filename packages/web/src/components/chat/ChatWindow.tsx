import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, ArrowLeft } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import "./ChatWindow.css";

interface Message {
  id: string;
  text?: string;
  timestamp: string;
  isOwnMessage: boolean;
  children?: React.ReactNode;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "¡Hola! Soy Rocket, tu asistente financiero. ¿En qué te puedo ayudar hoy?",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwnMessage: false,
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwnMessage: true,
    };

    setMessages((prev) => [...prev, newMessage]);

    // Simular respuesta del bot
    setTimeout(() => {
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Acabo de registrar tu transacción. En el futuro, aquí verás componentes interactivos de tus finanzas.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isOwnMessage: false,
      };
      setMessages((prev) => [...prev, responseMessage]);
    }, 1000);
  };

  return (
    <div className="chat-window">
      <header className="chat-header">
        <div className="header-left">
          <button className="icon-btn back-btn" aria-label="Volver">
            <ArrowLeft size={24} />
          </button>
          <div className="avatar">🚀</div>
          <div className="user-info">
            <h2>Rocket Bot</h2>
            <span>En línea</span>
          </div>
        </div>
        <div className="header-right">
          <button className="icon-btn" aria-label="Más opciones">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      <main className="chat-messages">
        <div className="messages-padding"></div>
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const isFirstInSequence =
            !prevMsg || prevMsg.isOwnMessage !== msg.isOwnMessage;

          return (
            <div
              key={msg.id}
              className={isFirstInSequence ? "first-in-sequence" : ""}
            >
              <MessageBubble
                id={msg.id}
                text={msg.text}
                timestamp={msg.timestamp}
                isOwnMessage={msg.isOwnMessage}
              >
                {msg.children}
              </MessageBubble>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      <footer className="chat-footer">
        <ChatInput onSendMessage={handleSendMessage} />
      </footer>
    </div>
  );
}
