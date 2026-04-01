import { useState } from "react";
import type { ToolCall, ToolResult } from "@rocket/shared";
import "./ToolConfirmCard.css";

interface ToolConfirmCardProps {
  toolCall: ToolCall;
  onConfirm: (toolCallId: string) => Promise<ToolResult>;
  onReject: (toolCallId: string) => Promise<ToolResult>;
}

type CardState = "pending" | "loading-confirm" | "loading-reject" | "confirmed" | "rejected";

export function ToolConfirmCard({ toolCall, onConfirm, onReject }: ToolConfirmCardProps) {
  const [cardState, setCardState] = useState<CardState>("pending");
  const [resultMessage, setResultMessage] = useState<string>("");

  const handleConfirm = async () => {
    setCardState("loading-confirm");
    try {
      const result = await onConfirm(toolCall.id);
      setResultMessage(result.message);
      setCardState("confirmed");
    } catch {
      setResultMessage("Error al ejecutar la tool.");
      setCardState("confirmed");
    }
  };

  const handleReject = async () => {
    setCardState("loading-reject");
    try {
      const result = await onReject(toolCall.id);
      setResultMessage(result.message);
      setCardState("rejected");
    } catch {
      setResultMessage("Error al cancelar la tool.");
      setCardState("rejected");
    }
  };

  const isLoading = cardState === "loading-confirm" || cardState === "loading-reject";
  const isResolved = cardState === "confirmed" || cardState === "rejected";

  if (isResolved) {
    return (
      <div className="tool-confirm-card">
        <div className={`tool-card-resolved ${cardState}`}>
          {resultMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="tool-confirm-card">
      {/* Header */}
      <div className="tool-card-header">
        <span className="tool-card-icon">🔧</span>
        <span className="tool-card-label">Tool</span>
        <span className="tool-card-name">{toolCall.name}</span>
      </div>

      {/* Parameters */}
      <div className="tool-card-params">
        {Object.entries(toolCall.params).map(([key, value]) => (
          <div key={key} className="tool-param-row">
            <span className="tool-param-key">{key}</span>
            <span className="tool-param-value">{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="tool-card-actions">
        <button
          className="tool-btn tool-btn-confirm"
          onClick={handleConfirm}
          disabled={isLoading}
          aria-label="Confirmar ejecución de tool"
        >
          {cardState === "loading-confirm" ? (
            <span className="tool-spinner" />
          ) : (
            "✅ Confirmar"
          )}
        </button>
        <button
          className="tool-btn tool-btn-reject"
          onClick={handleReject}
          disabled={isLoading}
          aria-label="Cancelar ejecución de tool"
        >
          {cardState === "loading-reject" ? (
            <span className="tool-spinner" />
          ) : (
            "✕ Cancelar"
          )}
        </button>
      </div>
    </div>
  );
}
