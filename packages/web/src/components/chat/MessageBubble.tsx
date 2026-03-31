import React from "react";
import "./MessageBubble.css";

export interface MessageBubbleProps {
  id: string;
  text?: string;
  timestamp: string;
  isOwnMessage: boolean;
  children?: React.ReactNode;
}

export function MessageBubble({
  text,
  timestamp,
  isOwnMessage,
  children,
}: MessageBubbleProps) {
  return (
    <div className={`bubble-container ${isOwnMessage ? "own" : "other"}`}>
      <div className="bubble">
        {text && <p className="bubble-text selectable">{text}</p>}
        {children && <div className="bubble-custom">{children}</div>}
        <span className="bubble-time">{timestamp}</span>
      </div>
    </div>
  );
}
