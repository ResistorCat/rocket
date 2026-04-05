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
import {
  getCurrentMonthKey,
  formatMoney,
  parseMonthRange,
  getMonthTotals,
} from "../lib/finance-utils";

const TOOL_CALL_START = "\n__TOOL_CALL__";
const TOOL_CALL_END = "__END_TOOL__\n";
const MAX_CONTEXT_MESSAGES = 10;
const MAX_CONTEXT_TOKENS = 2_500;

function formatContextMessage(isOwnMessage: boolean, text: string): string {
  return `${isOwnMessage ? "Usuario" : "Asistente"}: ${text}`;
}

async function getRecentMessageContext() {
  const recent = await db.query.messages.findMany({
    orderBy: (messages, { desc }) => [desc(messages.createdAt)],
    limit: MAX_CONTEXT_MESSAGES + 1,
  });

  const contextMessages = recent.slice(1).reverse();
  let contextText = contextMessages
    .map((message) => formatContextMessage(message.isOwnMessage, message.text))
    .join("\n\n");

  while (
    contextMessages.length > 1 &&
    chatRateLimiter.estimateTokens(contextText) > MAX_CONTEXT_TOKENS
  ) {
    contextMessages.shift();
    contextText = contextMessages
      .map((message) => formatContextMessage(message.isOwnMessage, message.text))
      .join("\n\n");
  }

  if (
    contextMessages.length === 1 &&
    chatRateLimiter.estimateTokens(contextText) > MAX_CONTEXT_TOKENS
  ) {
    const message = contextMessages[0];
    const label = formatContextMessage(message.isOwnMessage, "");
    const maxMessageChars = Math.max(0, MAX_CONTEXT_TOKENS * 4 - label.length - 2);
    const truncatedMessage = message.text.slice(-maxMessageChars);
    contextText = formatContextMessage(message.isOwnMessage, truncatedMessage);
  }

  return {
    messageIds: contextMessages.map((message) => message.id),
    text: contextText,
    estimatedTokens: contextText ? chatRateLimiter.estimateTokens(contextText) : 0,
  };
}

async function getFinanceSnapshot() {
  const monthKey = getCurrentMonthKey();
  const range = parseMonthRange(monthKey);

  const [categoryList, totals] = await Promise.all([
    db.query.categories.findMany({ where: isNull(categories.deletedAt) }),
    getMonthTotals(range),
  ]);

  const categoryNames = new Map(categoryList.map((c) => [c.id, c.name]));

  const topExpenses = Array.from(totals.expenseByCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoryId, amount]) => {
      const categoryName =
        categoryId === null ? "Sin categoría" : categoryNames.get(categoryId) ?? `Categoría ${categoryId}`;
      return `- ${categoryName}: ${formatMoney(amount)}`;
    });

  return {
    monthKey,
    text: [
      `RESUMEN FINANCIERO ACTUAL (${monthKey}):`,
      `- Ingresos: ${formatMoney(totals.totalIncome)}`,
      `- Gastos: ${formatMoney(totals.totalExpense)}`,
      `- Balance: ${formatMoney(totals.totalIncome - totals.totalExpense)}`,
      topExpenses.length > 0
        ? `- Gastos por categoría:\n${topExpenses.join("\n")}`
        : "- Gastos por categoría: (sin movimientos)",
    ].join("\n"),
  };
}

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

      // 1. Guardar mensaje del usuario en la DB.
      // Nota: los campos tokensIn/tokensOut/contextWindow/financeSnapshot son
      // intencionalmente NULL para mensajes del usuario. Los metadatos de contexto
      // se registran solo en la respuesta del bot, ya que el contexto se arma
      // *para* la invocación al LLM.
      await db.insert(messages).values({
        text: body.text,
        isOwnMessage: true,
      });

      // 2. Stream real desde Gemini con tool calls opcionales.
      const botTextChunks: string[] = [];
      const [systemPrompt, conversationContext, financeSnapshot] = await Promise.all([
        getSystemPrompt(),
        getRecentMessageContext(),
        getFinanceSnapshot(),
      ]);
      const combinedSystemInstruction = [
        systemPrompt.trim(),
        "",
        "CONTEXTO RECIENTE DE LA CONVERSACIÓN:",
        conversationContext.text || "(Sin historial previo)",
        "",
        financeSnapshot.text,
      ].join("\n");

      let promptTokensIn = chatRateLimiter.estimateTokens(
        `${combinedSystemInstruction}\n\nMENSAJE ACTUAL DEL USUARIO:\n${body.text}`
      );
      let promptTokensOut = 0;
      let sawProviderUsage = false;
      let outputTokensForPersistence = 0;

      try {
        const stream = geminiClient.generateStream({
          userMessage: body.text,
          systemInstruction: combinedSystemInstruction,
          functionDeclarations: chatFunctionDeclarations,
        });

        for await (const event of stream) {
          if (event.type === "usage") {
            sawProviderUsage = true;

            if (typeof event.promptTokens === "number" && event.promptTokens > 0) {
              promptTokensIn = event.promptTokens;
            }

            if (typeof event.responseTokens === "number" && event.responseTokens > 0) {
              promptTokensOut = event.responseTokens;
            }

            continue;
          }

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
      } finally {
        outputTokensForPersistence =
          promptTokensOut > 0
            ? promptTokensOut
            : sawProviderUsage
              ? chatRateLimiter.estimateTokens(botTextChunks.join(""))
              : 0;

        if (outputTokensForPersistence > 0) {
          chatRateLimiter.recordOutputTokens(outputTokensForPersistence);
        }
      }

      // 3. Guardar la respuesta del bot en la DB
      await db.insert(messages).values({
        text: botTextChunks.join(""),
        isOwnMessage: false,
        tokensIn: promptTokensIn,
        tokensOut: outputTokensForPersistence > 0 ? outputTokensForPersistence : undefined,
        contextWindow: JSON.stringify(conversationContext.messageIds),
        financeSnapshot: financeSnapshot.text,
      });
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    }
  );
