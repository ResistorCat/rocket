import { Elysia, t } from "elysia";
import { db } from "../db";
import { transactions, accounts, categories } from "../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { ApiResponse, Transaction } from "@rocket/shared";

export const transactionsRoutes = new Elysia({ prefix: "/api/transactions" })
  .get(
    "/",
    async ({ query, set }): Promise<ApiResponse<Transaction[]>> => {
      const { startDate, endDate, categoryId, type } = query;
      const conditions = [];

      if (startDate) {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) {
          set.status = 400;
          return { success: false, error: "Invalid startDate" };
        }
        conditions.push(gte(transactions.date, d));
      }
      if (endDate) {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) {
          set.status = 400;
          return { success: false, error: "Invalid endDate" };
        }
        conditions.push(lte(transactions.date, d));
      }
      if (categoryId !== undefined) {
        conditions.push(eq(transactions.categoryId, categoryId));
      }
      if (type) {
        conditions.push(eq(transactions.type, type as "income" | "expense"));
      }

      const results = await db.query.transactions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(transactions.date)],
      });

      return {
        success: true,
        data: results.map((t) => ({
          ...t,
          date: t.date.toISOString(),
          createdAt: t.createdAt.toISOString(),
        })),
      };
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        categoryId: t.Optional(t.Numeric()),
        type: t.Optional(t.Union([t.Literal("income"), t.Literal("expense")])),
      }),
    },
  )
  .post(
    "/",
    async ({ body, set }): Promise<ApiResponse<Transaction>> => {
      // Validar cuenta
      const account = await db.query.accounts.findFirst({
        where: eq(accounts.id, body.accountId),
      });

      if (!account) {
        set.status = 400;
        return { success: false, error: "Account not found" };
      }

      // Validar categoría si se proporciona
      if (body.categoryId) {
        const category = await db.query.categories.findFirst({
          where: eq(categories.id, body.categoryId),
        });
        if (!category) {
          set.status = 400;
          return { success: false, error: "Category not found" };
        }
      }

      const amount = body.amount;
      if (amount <= 0) {
        set.status = 400;
        return { success: false, error: "Amount must be greater than 0" };
      }

      const dateObj = new Date(body.date);
      if (isNaN(dateObj.getTime())) {
        set.status = 400;
        return { success: false, error: "Invalid date format" };
      }

      const [result] = await db
        .insert(transactions)
        .values({
          amount: body.amount,
          type: body.type,
          accountId: body.accountId,
          categoryId: body.categoryId,
          description: body.description,
          date: dateObj,
        })
        .returning();

      return {
        success: true,
        data: {
          ...result,
          date: result.date.toISOString(),
          createdAt: result.createdAt.toISOString(),
        },
      };
    },
    {
      body: t.Object({
        amount: t.Integer({ minimum: 1 }),
        type: t.Union([t.Literal("income"), t.Literal("expense")]),
        accountId: t.Integer(),
        categoryId: t.Optional(t.Nullable(t.Integer())),
        description: t.Optional(t.Nullable(t.String())),
        date: t.String(),
      }),
    },
  )
  .put(
    "/:id",
    async ({ params, body, set }): Promise<ApiResponse<Transaction>> => {
      const id = params.id;
      const updateData: any = {};

      if (body.amount !== undefined) {
        if (body.amount <= 0) {
          set.status = 400;
          return { success: false, error: "Amount must be greater than 0" };
        }
        updateData.amount = body.amount;
      }
      if (body.type !== undefined) updateData.type = body.type;
      if (body.accountId !== undefined) {
        const account = await db.query.accounts.findFirst({
          where: eq(accounts.id, body.accountId),
        });
        if (!account) {
          set.status = 400;
          return { success: false, error: "Account not found" };
        }
        updateData.accountId = body.accountId;
      }
      if (body.categoryId !== undefined) {
        if (body.categoryId !== null) {
          const category = await db.query.categories.findFirst({
            where: eq(categories.id, body.categoryId),
          });
          if (!category) {
            set.status = 400;
            return { success: false, error: "Category not found" };
          }
        }
        updateData.categoryId = body.categoryId;
      }
      if (body.description !== undefined)
        updateData.description = body.description;
      if (body.date !== undefined) {
        const dateObj = new Date(body.date);
        if (isNaN(dateObj.getTime())) {
          set.status = 400;
          return { success: false, error: "Invalid date format" };
        }
        updateData.date = dateObj;
      }

      if (Object.keys(updateData).length === 0) {
        set.status = 400;
        return { success: false, error: "No fields provided for update" };
      }

      const [updated] = await db
        .update(transactions)
        .set(updateData)
        .where(eq(transactions.id, id))
        .returning();

      if (!updated) {
        set.status = 404;
        return { success: false, error: "Transaction not found" };
      }

      return {
        success: true,
        data: {
          ...updated,
          date: updated.date.toISOString(),
          createdAt: updated.createdAt.toISOString(),
        },
      };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      body: t.Object({
        amount: t.Optional(t.Integer({ minimum: 1 })),
        type: t.Optional(t.Union([t.Literal("income"), t.Literal("expense")])),
        accountId: t.Optional(t.Integer()),
        categoryId: t.Optional(t.Nullable(t.Integer())),
        description: t.Optional(t.Nullable(t.String())),
        date: t.Optional(t.String()),
      }),
    },
  )
  .delete(
    "/:id",
    async ({ params, set }): Promise<ApiResponse<{ id: number }>> => {
      const id = params.id;
      const result = await db
        .delete(transactions)
        .where(eq(transactions.id, id))
        .returning();

      if (result.length === 0) {
        set.status = 404;
        return { success: false, error: "Transaction not found" };
      }

      return {
        success: true,
        data: { id },
      };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    },
  );
