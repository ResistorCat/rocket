import { Elysia, t } from "elysia";
import { db } from "../db";
import { messages } from "../db/schema";

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
        "He recibido tu mensaje. Por ahora esta es una respuesta predefinida para probar la conexión con la API en tiempo real. 🚀 Pronto podrás ver integraciones reales aquí.";
      
      const chunks = mockResponse.split(" ");
      
      // 4. Iniciar el streaming (Elysia v1+ supporta Web Standard Streams via generator objects type String)
      for (const chunk of chunks) {
        // Latencia artificial entre palabras para dar efecto de tipeo
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield chunk + " ";
      }

      // 5. Guardar la respuesta final en la DB
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
