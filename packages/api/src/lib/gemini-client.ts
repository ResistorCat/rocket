import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type FunctionDeclaration,
} from "@google/genai";

export type GeminiStreamEvent =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; args: Record<string, unknown> };

type GenerateStreamInput = {
  userMessage: string;
  systemInstruction: string;
  functionDeclarations?: FunctionDeclaration[];
};

type RetryOptions = {
  maxRetries: number;
  initialDelayMs: number;
};

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview";

function parseStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const maybeError = error as {
    status?: number;
    response?: { status?: number };
  };

  if (typeof maybeError.status === "number") {
    return maybeError.status;
  }

  if (typeof maybeError.response?.status === "number") {
    return maybeError.response.status;
  }

  return undefined;
}

function isRetryableError(error: unknown): boolean {
  const status = parseStatusCode(error);
  return status === 429 || status === 500 || status === 503 || status === 504;
}

function extractErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isSystemInstructionUnsupportedError(error: unknown): boolean {
  const text = extractErrorText(error).toLowerCase();
  return (
    text.includes("developer instruction is not enabled") ||
    text.includes("system instruction") ||
    text.includes("developer instruction")
  );
}

function isFunctionCallingUnsupportedError(error: unknown): boolean {
  const text = extractErrorText(error).toLowerCase();
  return (
    text.includes("function calling is not enabled") ||
    text.includes("function calling")
  );
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const canRetry = isRetryableError(error) && attempt < options.maxRetries;
      if (!canRetry) {
        throw error;
      }

      const exponentialDelay = options.initialDelayMs * 2 ** (attempt - 1);
      const jitterMs = Math.floor(Math.random() * 250);
      await Bun.sleep(exponentialDelay + jitterMs);
    }
  }

  throw new Error("Retry loop exhausted unexpectedly");
}

export class GeminiClient {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model = DEFAULT_MODEL) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  getModelName(): string {
    return this.model;
  }

  async *generateStream({
    userMessage,
    systemInstruction,
    functionDeclarations = [],
  }: GenerateStreamInput): AsyncGenerator<GeminiStreamEvent> {
    if (functionDeclarations.length === 0) {
      throw new Error("Function declarations are required in tools-only mode.");
    }

    const inlineInstructionPrompt = `Contexto del asistente:\n${systemInstruction}\n\nMensaje del usuario:\n${userMessage}`;

    const createStream = async (
      useSystemInstruction: boolean,
      inlineInstructionInPrompt: boolean
    ) =>
      withRetry(
        async () =>
          this.client.models.generateContentStream({
            model: this.model,
            contents: inlineInstructionInPrompt
              ? inlineInstructionPrompt
              : userMessage,
            config: {
              systemInstruction: useSystemInstruction
                ? systemInstruction
                : undefined,
              tools: [{ functionDeclarations }],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.AUTO,
                },
              },
            },
          }),
        {
          maxRetries: 3,
          initialDelayMs: 500,
        }
      );

    let responseStream;
    try {
      responseStream = await createStream(true, false);
    } catch (error) {
      if (isFunctionCallingUnsupportedError(error)) {
        throw new Error(
          `Model ${this.model} does not support required function calling.`
        );
      }

      if (isSystemInstructionUnsupportedError(error)) {
        try {
          responseStream = await createStream(false, true);
        } catch (fallbackError) {
          if (isFunctionCallingUnsupportedError(fallbackError)) {
            throw new Error(
              `Model ${this.model} does not support required function calling.`
            );
          }

          throw fallbackError;
        }
      } else {
        throw error;
      }
    }

    const emittedToolCalls = new Set<string>();

    for await (const chunk of responseStream) {
      const rawChunk = chunk as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: {
                name?: string;
                args?: unknown;
              };
            }>;
          };
        }>;
      };

      const candidates = Array.isArray(rawChunk.candidates)
        ? rawChunk.candidates
        : [];

      for (const candidate of candidates) {
        const parts = candidate.content?.parts;
        if (!Array.isArray(parts)) {
          continue;
        }

        for (const part of parts) {
          if (typeof part.text === "string" && part.text.length > 0) {
            yield {
              type: "text",
              text: part.text,
            };
          }

          const functionCall = part.functionCall;
          if (!functionCall || typeof functionCall.name !== "string") {
            continue;
          }

          const args =
            typeof functionCall.args === "object" && functionCall.args !== null
              ? (functionCall.args as Record<string, unknown>)
              : {};

          const dedupeKey = `${functionCall.name}:${JSON.stringify(args)}`;
          if (emittedToolCalls.has(dedupeKey)) {
            continue;
          }
          emittedToolCalls.add(dedupeKey);

          yield {
            type: "toolCall",
            name: functionCall.name,
            args,
          };
        }
      }
    }
  }
}
