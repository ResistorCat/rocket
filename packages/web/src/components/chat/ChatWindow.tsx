import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, ArrowLeft } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { processCommand } from "../../lib/chatCommands";
import "./ChatWindow.css";

interface Message {
  id: string;
  text?: string;
  timestamp: string;
  isOwnMessage: boolean;
  children?: React.ReactNode;
}

export function ChatWindow() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch(`${API_URL}/api/chat`)
      .then((res) => res.json())
      .then((data: Message[]) => {
        setMessages(data);
      })
      .catch((err) => console.error("Failed to fetch chat history:", err))
      .finally(() => setIsFetchingHistory(false));
  }, [API_URL]);

  const handleSendMessage = async (text: string) => {
    if (isTyping) return;

    const isCommand = text.trim().startsWith("!");

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

    if (isCommand) {
      processCommand(text, {
        clearChat: async () => {
          try {
            await fetch(`${API_URL}/api/chat`, { method: "DELETE" });
            setMessages([]);
          } catch (e) {
            console.error("Failed to clear chat:", e);
          }
        },
        addBotMessage: (botText: string) => {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString() + Math.random().toString().substring(2, 5),
              text: botText,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isOwnMessage: false,
            },
          ]);
        },
      });
      return;
    }

    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.body) throw new Error("No response body");

      const botMessageId = (Date.now() + 1).toString();
      const botMessage: Message = {
        id: botMessageId,
        text: "",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isOwnMessage: false,
      };

      setMessages((prev) => [...prev, botMessage]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId
              ? { ...msg, text: msg.text + chunk }
              : msg
          )
        );
      }
    } catch (err) {
      console.error("Error with chat stream:", err);
    } finally {
      setIsTyping(false);
    }
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
        {isFetchingHistory && (
          <div style={{ textAlign: "center", padding: "1rem" }}>Cargando historial...</div>
        )}
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
        <ChatInput onSendMessage={handleSendMessage} isLoading={isTyping} />
      </footer>
    </div>
  );
}
