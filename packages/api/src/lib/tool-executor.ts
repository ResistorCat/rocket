import { db } from "../db";
import { accounts, categories, transactions, budgets } from "../db/schema";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import type { ToolResult } from "@rocket/shared";

export const WRITE_TOOLS = new Set(["registrar_gasto", "registrar_ingreso"]);
export const READ_TOOLS = new Set([
  "consultar_resumen",
  "consultar_presupuesto",
  "listar_categorias",
]);

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}

export function isReadTool(name: string): boolean {
  return READ_TOOLS.has(name);
}

/**
 * Gets the default account (ID 1) or creates it if it doesn't exist.
 */
async function getOrCreateDefaultAccount() {
  const existing = await db.query.accounts.findFirst({
    where: eq(accounts.id, 1),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(accounts)
    .values({
      id: 1,
      name: "Cuenta Principal",
      currency: "ARS",
    })
    .returning();

  return created;
}

/**
 * Gets a category by name (case insensitive) or creates it if it doesn't exist.
 */
async function getOrCreateCategory(name: string) {
  const normalized = name.trim();
  const existing = await db.query.categories.findFirst({
    where: and(
      eq(categories.name, normalized),
      isNull(categories.deletedAt)
    ),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(categories)
    .values({
      name: normalized,
      icon: "file-text", // Default icon
    })
    .returning();

  return created;
}

/**
 * Executes a tool and returns a ToolResult.
 */
export async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<ToolResult> {
  try {
    switch (name) {
      case "registrar_gasto":
      case "registrar_ingreso":
        return await handleRegisterTransaction(name, args);
      case "consultar_resumen":
        return await handleConsultarResumen(args);
      case "consultar_presupuesto":
        return await handleConsultarPresupuesto(args);
      case "listar_categorias":
        return await handleListarCategorias();
      default:
        return {
          toolCallId: "",
          success: false,
          message: `Tool "${name}" no implementada.`,
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      toolCallId: "",
      success: false,
      message: `Error al ejecutar ${name}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function handleRegisterTransaction(
  name: string,
  args: Record<string, any>
): Promise<ToolResult> {
  const type = name === "registrar_gasto" ? "expense" : "income";
  const { monto, categoria, descripcion, fecha } = args;

  const account = await getOrCreateDefaultAccount();
  const category = await getOrCreateCategory(categoria);

  const amountInt = Math.round(monto * 100);
  let dateObj = new Date();

  if (fecha) {
    const [year, month, day] = fecha.split("-").map(Number);
    // Use local timezone constructor: new Date(year, month - 1, day)
    dateObj = new Date(year, month - 1, day);
  }

  const [result] = await db
    .insert(transactions)
    .values({
      amount: amountInt,
      type,
      accountId: account.id,
      categoryId: category.id,
      description: descripcion || null,
      date: dateObj,
    })
    .returning();

  const symbol = type === "expense" ? "💸" : "💰";
  const typeLabel = type === "expense" ? "Gasto" : "Ingreso";

  return {
    toolCallId: "",
    success: true,
    message: `${symbol} ${typeLabel} registrado: ${categoria} por $${monto.toFixed(2)}.`,
    data: result,
  };
}

async function handleConsultarResumen(args: Record<string, any>): Promise<ToolResult> {
  const mes = args.mes || new Date().toISOString().slice(0, 7); // YYYY-MM
  const [yearStr, monthStr] = mes.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const results = await db.query.transactions.findMany({
    where: and(
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ),
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of results) {
    if (t.type === "income") totalIncome += t.amount;
    else totalExpense += t.amount;
  }

  const format = (cents: number) => (cents / 100).toFixed(2);

  let message = `📊 Resumen de ${mes}:\n`;
  message += `• Ingresos: $${format(totalIncome)}\n`;
  message += `• Gastos: $${format(totalExpense)}\n`;
  message += `• Balance: $${format(totalIncome - totalExpense)}`;

  return {
    toolCallId: "",
    success: true,
    message,
    data: { totalIncome, totalExpense, month: mes },
  };
}

async function handleConsultarPresupuesto(args: Record<string, any>): Promise<ToolResult> {
  const mes = args.mes || new Date().toISOString().slice(0, 7);
  const [yearStr, monthStr] = mes.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch budgets and actual expenses
  const monthlyBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.year, year), eq(budgets.month, month)),
    with: { category: true },
  });

  const expenses = await db.query.transactions.findMany({
    where: and(
      eq(transactions.type, "expense"),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate)
    ),
  });

  const expenseMap = new Map<number, number>();
  for (const exp of expenses) {
    if (exp.categoryId !== null) {
      expenseMap.set(exp.categoryId, (expenseMap.get(exp.categoryId) || 0) + exp.amount);
    }
  }

  const format = (cents: number) => (cents / 100).toFixed(2);
  let message = `🎯 Presupuesto ${mes}:\n`;

  if (monthlyBudgets.length === 0) {
    message += "No tienes presupuestos configurados para este mes.";
  } else {
    for (const b of monthlyBudgets) {
      const category = b.category;
      const spent = expenseMap.get(b.categoryId) || 0;
      const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const status = percent >= 100 ? "⚠️" : percent > 80 ? "🟡" : "🟢";
      
      message += `${status} ${category?.name || "Sin nombre"}: $${format(spent)} / $${format(b.amount)} (${percent.toFixed(0)}%)\n`;
    }
  }

  return {
    toolCallId: "",
    success: true,
    message,
    data: { mes, budgets: monthlyBudgets },
  };
}

async function handleListarCategorias(): Promise<ToolResult> {
  const results = await db.query.categories.findMany({
    where: isNull(categories.deletedAt),
  });

  if (results.length === 0) {
    return {
      toolCallId: "",
      success: true,
      message: "No hay categorías registradas aún.",
      data: [],
    };
  }

  let message = "🏷️ Categorías disponibles:\n";
  message += results.map((c) => `• ${c.name}`).join("\n");

  return {
    toolCallId: "",
    success: true,
    message,
    data: results,
  };
}
