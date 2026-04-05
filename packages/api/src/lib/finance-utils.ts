import { db } from "../db";
import { transactions } from "../db/schema";
import { and, gte, lte } from "drizzle-orm";

export type MonthRange = {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
};

export type MonthTotals = {
  totalIncome: number;
  totalExpense: number;
  expenseByCategory: Map<number | null, number>;
};

/**
 * Parses a "YYYY-MM" month key into year/month integers and date boundaries.
 * Uses local-timezone Date constructor to avoid the day-off bug.
 */
export function parseMonthRange(monthKey: string): MonthRange {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  return {
    year,
    month,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

/**
 * Returns a month key like "2026-04" for the given date.
 */
export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Formats an amount in cents to a dollar string like "$15.50".
 */
export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Fetches all transactions for a given month range and computes
 * totals for income, expenses, and expense breakdown by category.
 */
export async function getMonthTotals(range: MonthRange): Promise<MonthTotals> {
  const monthTransactions = await db.query.transactions.findMany({
    where: and(
      gte(transactions.date, range.startDate),
      lte(transactions.date, range.endDate)
    ),
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory = new Map<number | null, number>();

  for (const transaction of monthTransactions) {
    if (transaction.type === "income") {
      totalIncome += transaction.amount;
      continue;
    }

    totalExpense += transaction.amount;
    const current = expenseByCategory.get(transaction.categoryId) ?? 0;
    expenseByCategory.set(transaction.categoryId, current + transaction.amount);
  }

  return { totalIncome, totalExpense, expenseByCategory };
}
