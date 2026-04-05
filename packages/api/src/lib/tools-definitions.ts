import type { FunctionDeclaration } from "@google/genai";

export const chatFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "registrar_gasto",
    description: "Registra un nuevo gasto (egreso).",
    parametersJsonSchema: {
      type: "object",
      properties: {
        monto: { type: "number", description: "Monto del gasto (ej: 1500.50)." },
        categoria: { type: "string", description: "Nombre de la categoría (ej: 'Almuerzo')." },
        descripcion: { type: "string", description: "Breve descripción opcional." },
        fecha: { type: "string", description: "Fecha opcional en formato YYYY-MM-DD." },
      },
      required: ["monto", "categoria"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_ingreso",
    description: "Registra un nuevo ingreso.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        monto: { type: "number", description: "Monto del ingreso." },
        categoria: { type: "string", description: "Nombre de la categoría (ej: 'Sueldo')." },
        descripcion: { type: "string", description: "Breve descripción opcional." },
        fecha: { type: "string", description: "Fecha opcional en formato YYYY-MM-DD." },
      },
      required: ["monto", "categoria"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_resumen",
    description: "Consulta el resumen financiero (totales, ingresos vs gastos) de un mes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "Mes en formato YYYY-MM. Default: Mes actual." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "consultar_presupuesto",
    description: "Consulta el estado del presupuesto para una categoría o el mes completo.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "Mes en formato YYYY-MM." },
        categoria: { type: "string", description: "Nombre de categoría opcional." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "listar_categorias",
    description: "Lista todas las categorías activas en el sistema.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];
