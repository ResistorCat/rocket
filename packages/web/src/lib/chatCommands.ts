export interface CommandContext {
  clearChat: () => void;
  addBotMessage: (text: string) => void;
}

export type CommandHandler = (args: string[], context: CommandContext) => void;

// Simple registry for prefix commands
export const commands: Record<string, CommandHandler> = {
  clear: (_args, { clearChat }) => {
    clearChat();
  },
  help: (_args, { addBotMessage }) => {
    addBotMessage(
      "🤖 Comandos de Rocket Bot:\n\n" +
      "¡Hola! Soy tu asistente financiero. Aquí tienes lo que puedo hacer por ahora:\n\n" +
      "🔹 !help — Muestra este menú de ayuda.\n" +
      "🔹 !clear — Limpia la pantalla para empezar de cero.\n\n" +
      "🚀 Próximamente tendré más funciones interactivas."
    );
  },
};

/**
 * Parses and executes a command if the text starts with the "!" prefix.
 * @returns true if the text was processed as a command, false otherwise.
 */
export function processCommand(text: string, context: CommandContext): boolean {
  if (!text.startsWith("!")) return false;

  const [cmdWithPrefix, ...args] = text.trim().split(/\s+/);
  const cmd = cmdWithPrefix.slice(1).toLowerCase();

  const handler = commands[cmd];
  if (handler) {
    handler(args, context);
  } else {
    context.addBotMessage(
      `Comando no reconocido: !${cmd}. Usa !help para ver opciones.`
    );
  }

  return true;
}
