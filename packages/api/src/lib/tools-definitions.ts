import type { FunctionDeclaration } from "@google/genai";

export const chatFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "registrar_transaccion",
    description:
      "Solicita registrar una transaccion financiera (ingreso o gasto) para posterior confirmacion del usuario.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description:
            "Monto en unidad decimal legible para usuario (por ejemplo 25.99).",
        },
        type: {
          type: "string",
          enum: ["income", "expense"],
          description: "Tipo de transaccion.",
        },
        categoryId: {
          type: "number",
          description: "ID de categoria existente en el sistema.",
        },
        accountId: {
          type: "number",
          description: "ID de cuenta existente en el sistema.",
        },
        description: {
          type: "string",
          description: "Descripcion corta de la transaccion.",
        },
        date: {
          type: "string",
          description: "Fecha en formato ISO YYYY-MM-DD.",
        },
      },
      required: ["amount", "type", "accountId", "date"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_resumen_mensual",
    description:
      "Solicita consultar el resumen de ingresos y gastos de un mes especifico.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Mes en formato YYYY-MM.",
        },
      },
      required: ["month"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_presupuesto_mensual",
    description:
      "Solicita consultar presupuesto versus gasto del mes especificado.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: "Mes en formato YYYY-MM.",
        },
      },
      required: ["month"],
      additionalProperties: false,
    },
  },
];
