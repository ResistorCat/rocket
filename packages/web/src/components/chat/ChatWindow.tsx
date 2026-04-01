import { useState, useRef, useEffect } from "react";
import { MoreVertical, ArrowLeft } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ToolConfirmCard } from "./ToolConfirmCard";
import { processCommand } from "../../lib/chatCommands";
import type { ToolCall, ToolResult } from "@rocket/shared";
import "./ChatWindow.css";

/** Delimiters that the API stream uses to embed tool call data */
const TOOL_CALL_START = "\n__TOOL_CALL__";
const TOOL_CALL_END = "__END_TOOL__\n";

interface Message {
  id: string;
  text?: string;
  timestamp: string;
  isOwnMessage: boolean;
  toolCall?: ToolCall;
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

  /** Calls the confirm endpoint and returns the result */
  const handleToolConfirm = async (toolCallId: string): Promise<ToolResult> => {
    const res = await fetch(`${API_URL}/api/tools/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId }),
    });
    return res.json() as Promise<ToolResult>;
  };

  /** Calls the reject endpoint and returns the result */
  const handleToolReject = async (toolCallId: string): Promise<ToolResult> => {
    const res = await fetch(`${API_URL}/api/tools/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId }),
    });
    return res.json() as Promise<ToolResult>;
  };

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "No se pudo procesar el mensaje.");
      }

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
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Check if the buffer contains a complete tool call delimiter
        const startIdx = buffer.indexOf(TOOL_CALL_START);
        const endIdx = buffer.indexOf(TOOL_CALL_END);

        if (startIdx !== -1 && endIdx !== -1) {
          // Extract clean text (before the tool call marker)
          const cleanText = buffer.substring(0, startIdx);

          // Extract the tool call JSON
          const jsonStr = buffer.substring(
            startIdx + TOOL_CALL_START.length,
            endIdx
          );

          let toolCall: ToolCall | undefined;
          try {
            toolCall = JSON.parse(jsonStr) as ToolCall;
          } catch {
            console.error("Failed to parse tool call JSON:", jsonStr);
          }

          // Update the bot message: set final text and attach tool call
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, text: (msg.text ?? "") + cleanText, toolCall }
                : msg
            )
          );

          // Clear the buffer after processing
          buffer = buffer.substring(endIdx + TOOL_CALL_END.length);
        } else if (startIdx === -1) {
          // No tool call in buffer yet — stream text normally
          const textChunk = buffer;
          buffer = "";
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId
                ? { ...msg, text: (msg.text ?? "") + textChunk }
                : msg
            )
          );
        }
        // If we have TOOL_CALL_START but not END yet, keep accumulating in buffer
      }
    } catch (err) {
      console.error("Error with chat stream:", err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : "Error desconocido durante la comunicacion con el chat.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-error",
          text: `No pude responder: ${errorMessage}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isOwnMessage: false,
        },
      ]);
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
                {msg.toolCall && (
                  <ToolConfirmCard
                    toolCall={msg.toolCall}
                    onConfirm={handleToolConfirm}
                    onReject={handleToolReject}
                  />
                )}
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
