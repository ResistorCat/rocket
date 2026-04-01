import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages } from "../db/schema";
import { pendingToolCalls } from "./tools";

/** Delimiter used to embed tool call JSON in the text stream */
const TOOL_CALL_START = "\n__TOOL_CALL__";
const TOOL_CALL_END = "__END_TOOL__\n";

export const chatRoutes = new Elysia({ prefix: "/api/chat" })
  .get("/", async () => {
    // Retornamos el historial completo (podría limitarse, pero por ahora todo)
    const history = await db.query.messages.findMany({
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    return history.map((m) => ({
      id: m.id.toString(),
      text: m.text,
      isOwnMessage: Boolean(m.isOwnMessage),
      timestamp: m.createdAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  })
  .delete("/", async () => {
    // Borramos todo el historial de la DB
    await db.delete(messages);
    return { success: true };
  })
  .post(
    "/",
    async function* ({ body }) {
      // 1. Guardar mensaje del usuario en la DB
      await db.insert(messages).values({
        text: body.text,
        isOwnMessage: true,
      });

      // 2. Simular un tiempo de pensamiento ("typing")
      await new Promise((resolve) => setTimeout(resolve, 600));

      // 3. Preparar mensaje predefinido con la respuesta del bot
      const mockResponse =
        "Entendido. Para registrar esta operación necesito confirmación antes de continuar.";

      const chunks = mockResponse.split(" ");

      // 4. Streaming del texto de respuesta
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield chunk + " ";
      }

      // 5. Generar una tool call mock y registrarla en el store en memoria
      const toolCallId = `tc_${Date.now()}`;
      const toolCall = {
        id: toolCallId,
        name: "registrar_gasto",
        params: {
          descripcion: body.text,
          monto: 5000,
          categoria: "General",
        },
        status: "pending" as const,
      };
      pendingToolCalls.set(toolCallId, toolCall);

      // 6. Emitir el chunk especial con la tool call para que el frontend lo parsee
      yield `${TOOL_CALL_START}${JSON.stringify(toolCall)}${TOOL_CALL_END}`;

      // 7. Guardar la respuesta del bot en la DB (sin el chunk de tool call)
      await db.insert(messages).values({
        text: mockResponse,
        isOwnMessage: false,
      });
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    }
  );
