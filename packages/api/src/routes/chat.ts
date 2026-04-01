import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages } from "../db/schema";
import { pendingToolCalls } from "./tools";
import { GeminiClient } from "../lib/gemini-client";
import { chatFunctionDeclarations } from "../lib/tools-definitions";
import { chatRateLimiter } from "../lib/rate-limiter";

/** Delimiter used to embed tool call JSON in the text stream */
const TOOL_CALL_START = "\n__TOOL_CALL__";
const TOOL_CALL_END = "__END_TOOL__\n";

const GEMINI_SYSTEM_PROMPT = `
Eres Rocket Bot, un asistente financiero personal en espanol.
Ayuda al usuario con explicaciones claras sobre ingresos, gastos y presupuesto.
Cuando el usuario pida acciones financieras, puedes proponer una tool call.
Nunca confirmes que una transaccion fue ejecutada sin confirmacion del usuario.
`;

const geminiClient = new GeminiClient(process.env.GOOGLE_API_KEY ?? "");

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
    async function* ({ body, set }) {
      const estimatedInputTokens = chatRateLimiter.estimateTokens(body.text);
      const rateLimit = chatRateLimiter.checkAndRecord(estimatedInputTokens);
      if (!rateLimit.allowed) {
        set.status = 429;

        if (rateLimit.reason === "rpd") {
          yield "Limite diario alcanzado para Gemini. Intenta nuevamente mañana.";
          return;
        }

        if (rateLimit.reason === "tpm") {
          yield `Limite de tokens por minuto alcanzado. Intenta de nuevo en ${rateLimit.retryAfterSeconds}s.`;
          return;
        }

        yield `Limite de requests por minuto alcanzado. Intenta de nuevo en ${rateLimit.retryAfterSeconds}s.`;
        return;
      }

      // 1. Guardar mensaje del usuario en la DB
      await db.insert(messages).values({
        text: body.text,
        isOwnMessage: true,
      });

      // 2. Stream real desde Gemini con tool calls opcionales.
      const botTextChunks: string[] = [];

      try {
        const stream = geminiClient.generateStream({
          userMessage: body.text,
          systemInstruction: GEMINI_SYSTEM_PROMPT,
          functionDeclarations: chatFunctionDeclarations,
        });

        for await (const event of stream) {
          if (event.type === "text") {
            botTextChunks.push(event.text);
            yield event.text;
            continue;
          }

          const toolCallId = crypto.randomUUID();
          const toolCall = {
            id: toolCallId,
            name: event.name,
            params: event.args,
            status: "pending" as const,
          };

          pendingToolCalls.set(toolCallId, toolCall);
          yield `${TOOL_CALL_START}${JSON.stringify(toolCall)}${TOOL_CALL_END}`;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo obtener respuesta del proveedor LLM.";

        const fallback = `\n[Error Gemini] ${message}`;
        botTextChunks.push(fallback);
        yield fallback;
      }

      // 3. Guardar la respuesta del bot en la DB
      await db.insert(messages).values({
        text: botTextChunks.join(""),
        isOwnMessage: false,
      });
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    }
  );
