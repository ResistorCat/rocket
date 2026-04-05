import { db } from "../db";
import { accounts, categories, transactions, budgets } from "../db/schema";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import type { ToolResult } from "@rocket/shared";
import {
  getCurrentMonthKey,
  formatMoney,
  parseMonthRange,
  getMonthTotals,
} from "./finance-utils";

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
  const mes = args.mes || getCurrentMonthKey();
  const range = parseMonthRange(mes);
  const totals = await getMonthTotals(range);

  let message = `📊 Resumen de ${mes}:\n`;
  message += `• Ingresos: ${formatMoney(totals.totalIncome)}\n`;
  message += `• Gastos: ${formatMoney(totals.totalExpense)}\n`;
  message += `• Balance: ${formatMoney(totals.totalIncome - totals.totalExpense)}`;

  return {
    toolCallId: "",
    success: true,
    message,
    data: { totalIncome: totals.totalIncome, totalExpense: totals.totalExpense, month: mes },
  };
}

async function handleConsultarPresupuesto(args: Record<string, any>): Promise<ToolResult> {
  const mes = args.mes || getCurrentMonthKey();
  const range = parseMonthRange(mes);

  // Fetch budgets and actual expenses
  const [monthlyBudgets, totals] = await Promise.all([
    db.query.budgets.findMany({
      where: and(eq(budgets.year, range.year), eq(budgets.month, range.month)),
      with: { category: true },
    }),
    getMonthTotals(range),
  ]);

  let message = `🎯 Presupuesto ${mes}:\n`;

  if (monthlyBudgets.length === 0) {
    message += "No tienes presupuestos configurados para este mes.";
  } else {
    for (const b of monthlyBudgets) {
      const category = b.category;
      const spent = totals.expenseByCategory.get(b.categoryId) || 0;
      const percent = b.amount > 0 ? (spent / b.amount) * 100 : 0;
      const status = percent >= 100 ? "⚠️" : percent > 80 ? "🟡" : "🟢";
      
      message += `${status} ${category?.name || "Sin nombre"}: ${formatMoney(spent)} / ${formatMoney(b.amount)} (${percent.toFixed(0)}%)\n`;
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
