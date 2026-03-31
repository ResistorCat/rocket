import { Elysia, t } from "elysia";
import { db } from "../db";
import { transactions, budgets } from "../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import type {
  ApiResponse,
  FinanceSummary,
  FinanceBudget,
  CategorySummary,
  CategoryBudget,
} from "@rocket/shared";

export const financeRoutes = new Elysia({ prefix: "/api/finance" })
  .get(
    "/summary",
    async ({ query, set }): Promise<ApiResponse<FinanceSummary>> => {
      const { month } = query;
      // month is YYYY-MM
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);

      if (isNaN(year) || isNaN(m) || m < 1 || m > 12) {
        set.status = 400;
        return { success: false, error: "Invalid month format. Use YYYY-MM" };
      }

      // Calculate start and end date
      const startDate = new Date(year, m - 1, 1);
      const endDate = new Date(year, m, 0, 23, 59, 59, 999);

      const results = await db.query.transactions.findMany({
        where: and(
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      });

      let totalIncome = 0;
      let totalExpense = 0;
      const incomeMap = new Map<number | null, number>();
      const expenseMap = new Map<number | null, number>();

      for (const t of results) {
        if (t.type === "income") {
          totalIncome += t.amount;
          const current = incomeMap.get(t.categoryId) || 0;
          incomeMap.set(t.categoryId, current + t.amount);
        } else if (t.type === "expense") {
          totalExpense += t.amount;
          const current = expenseMap.get(t.categoryId) || 0;
          expenseMap.set(t.categoryId, current + t.amount);
        }
      }

      const mapToCategorySummary = (
        map: Map<number | null, number>,
      ): CategorySummary[] => {
        return Array.from(map.entries()).map(([categoryId, amount]) => ({
          categoryId,
          amount,
        }));
      };

      return {
        success: true,
        data: {
          totalIncome,
          totalExpense,
          incomeByCategory: mapToCategorySummary(incomeMap),
          expenseByCategory: mapToCategorySummary(expenseMap),
        },
      };
    },
    {
      query: t.Object({
        month: t.String({ pattern: "^\\d{4}-\\d{2}$" }),
      }),
    },
  )
  .get(
    "/budget",
    async ({ query, set }): Promise<ApiResponse<FinanceBudget>> => {
      const { month } = query;
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);

      if (isNaN(year) || isNaN(m) || m < 1 || m > 12) {
        set.status = 400;
        return { success: false, error: "Invalid month format. Use YYYY-MM" };
      }

      const startDate = new Date(year, m - 1, 1);
      const endDate = new Date(year, m, 0, 23, 59, 59, 999);

      // Fetch budgets
      const monthlyBudgets = await db.query.budgets.findMany({
        where: and(eq(budgets.year, year), eq(budgets.month, m)),
      });

      // Fetch expenses
      const expenses = await db.query.transactions.findMany({
        where: and(
          eq(transactions.type, "expense"),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      });

      const expenseMap = new Map<number, number>();
      for (const exp of expenses) {
        if (exp.categoryId !== null) {
          const current = expenseMap.get(exp.categoryId) || 0;
          expenseMap.set(exp.categoryId, current + exp.amount);
        }
      }

      const budgetedCategoryIds = new Set(monthlyBudgets.map((b) => b.categoryId));

      const categories: CategoryBudget[] = monthlyBudgets.map((b) => {
        const spent = expenseMap.get(b.categoryId) || 0;
        return {
          categoryId: b.categoryId,
          budgeted: b.amount,
          spent,
          remaining: b.amount - spent,
        };
      });

      for (const [categoryId, spent] of expenseMap.entries()) {
        if (!budgetedCategoryIds.has(categoryId)) {
          categories.push({
            categoryId,
            budgeted: 0,
            spent,
            remaining: -spent,
          });
        }
      }

      return {
        success: true,
        data: {
          year,
          month: m,
          categories,
        },
      };
    },
    {
      query: t.Object({
        month: t.String({ pattern: "^\\d{4}-\\d{2}$" }),
      }),
    },
  );
