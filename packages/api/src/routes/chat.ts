import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages, categories } from "../db/schema";
import { isNull } from "drizzle-orm";
import { pendingToolCalls } from "./tools";
import { GeminiClient } from "../lib/gemini-client";
import { chatFunctionDeclarations } from "../lib/tools-definitions";
import { chatRateLimiter } from "../lib/rate-limiter";
import {
  isReadTool,
  isWriteTool,
  executeTool,
} from "../lib/tool-executor";

const TOOL_CALL_START = "\n__TOOL_CALL__";
const TOOL_CALL_END = "__END_TOOL__\n";

async function getSystemPrompt() {
  const cats = await db.query.categories.findMany({
    where: isNull(categories.deletedAt),
  });
  const accts = await db.query.accounts.findMany();

  const categoryList = cats.map((c) => `- ${c.name}`).join("\n");
  const accountList = accts.map((a) => `- ${a.name} (${a.currency})`).join("\n");

  return `
Eres Rocket Bot, un asistente financiero personal en español.
Ayuda al usuario con explicaciones claras sobre ingresos, gastos y presupuesto.

FECHA ACTUAL: ${new Date().toLocaleDateString("es-CL")}

CATEGORÍAS EXISTENTES:
${categoryList || "(Ninguna)"}

CUENTAS EXISTENTES:
${accountList || "(Ninguna)"}

INSTRUCCIONES:
1. Usa las herramientas proporcionadas para registrar transacciones o consultar datos.
2. Si el usuario menciona una categoría que no existe, úsala igualmente; el sistema la creará automáticamente.
3. Para registrar un gasto o ingreso, SIEMPRE usa las tools 'registrar_gasto' o 'registrar_ingreso'.
4. NUNCA inventes que una transacción fue registrada sin confirmación (para tools de escritura).
5. Las consultas (resumen, presupuesto, categorías) se ejecutarán automáticamente.
`;
}

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
      const systemPrompt = await getSystemPrompt();

      try {
        const stream = geminiClient.generateStream({
          userMessage: body.text,
          systemInstruction: systemPrompt,
          functionDeclarations: chatFunctionDeclarations,
        });

        for await (const event of stream) {
          if (event.type === "text") {
            botTextChunks.push(event.text);
            yield event.text;
            continue;
          }

          if (isReadTool(event.name)) {
            // Ejecución inmediata para herramientas de lectura
            const result = await executeTool(event.name, event.args);
            const formattedResult = `\n\n${result.message}\n`;
            botTextChunks.push(formattedResult);
            yield formattedResult;
          } else if (isWriteTool(event.name)) {
            // Flujo de confirmación para herramientas de escritura
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
