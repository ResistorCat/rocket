import { Elysia, t } from "elysia";
import type { ToolCall, ToolResult } from "@rocket/shared";

/**
 * In-memory store for pending tool calls.
 * Tool calls are ephemeral (cleared on server restart) — this is intentional
 * for now, as they represent real-time agent interactions.
 */
export const pendingToolCalls = new Map<string, ToolCall>();

export const toolsRoutes = new Elysia({ prefix: "/api/tools" })
  .post(
    "/confirm",
    ({ body }): ToolResult => {
      const toolCall = pendingToolCalls.get(body.toolCallId);

      if (!toolCall) {
        return {
          toolCallId: body.toolCallId,
          success: false,
          message: "Tool call no encontrada o ya fue procesada.",
        };
      }

      // Update status to confirmed and remove from pending store
      toolCall.status = "confirmed";
      pendingToolCalls.delete(body.toolCallId);

      // Mock execution result — will be replaced by real LLM tool execution later
      return {
        toolCallId: body.toolCallId,
        success: true,
        message: `✅ Tool "${toolCall.name}" ejecutada correctamente.`,
      };
    },
    {
      body: t.Object({
        toolCallId: t.String(),
      }),
    }
  )
  .post(
    "/reject",
    ({ body }): ToolResult => {
      const toolCall = pendingToolCalls.get(body.toolCallId);

      if (!toolCall) {
        return {
          toolCallId: body.toolCallId,
          success: false,
          message: "Tool call no encontrada o ya fue procesada.",
        };
      }

      // Update status to rejected and remove from pending store
      toolCall.status = "rejected";
      pendingToolCalls.delete(body.toolCallId);

      return {
        toolCallId: body.toolCallId,
        success: true,
        message: `❌ Tool "${toolCall.name}" cancelada por el usuario.`,
      };
    },
    {
      body: t.Object({
        toolCallId: t.String(),
      }),
    }
  );
