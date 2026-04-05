import { Elysia, t } from "elysia";
import type { ToolCall, ToolResult } from "@rocket/shared";

import { executeTool } from "../lib/tool-executor";

/**
 * In-memory store for pending tool calls.
 */
export const pendingToolCalls = new Map<string, ToolCall>();

export const toolsRoutes = new Elysia({ prefix: "/api/tools" })
  .post(
    "/confirm",
    async ({ body }): Promise<ToolResult> => {
      const toolCall = pendingToolCalls.get(body.toolCallId);

      if (!toolCall) {
        return {
          toolCallId: body.toolCallId,
          success: false,
          message: "Tool call no encontrada o ya fue procesada.",
        };
      }

      // Execute real tool logic
      const result = await executeTool(toolCall.name, toolCall.params);
      
      // Update status and remove from pending store
      toolCall.status = "confirmed";
      pendingToolCalls.delete(body.toolCallId);

      return {
        ...result,
        toolCallId: body.toolCallId,
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
