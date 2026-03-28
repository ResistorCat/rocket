import { Elysia, t } from 'elysia';
import { db } from '../db';
import { categories, transactions } from '../db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import type { ApiResponse, Category } from '@rocket/shared';

export const categoriesRoutes = new Elysia({ prefix: '/api/categories' })
  .get('/', async ({ query }): Promise<ApiResponse<Category[]>> => {
    const includeDeleted = query.includeDeleted === 'true';
    
    const results = await db.query.categories.findMany({
      where: includeDeleted ? undefined : isNull(categories.deletedAt)
    });

    return {
      success: true,
      data: results.map(c => ({
        ...c,
        deletedAt: c.deletedAt?.toISOString() ?? null
      }))
    };
  }, {
    query: t.Object({
      includeDeleted: t.Optional(t.String())
    })
  })
  .post('/', async ({ body }): Promise<ApiResponse<Category>> => {
    const [result] = await db.insert(categories).values({
      name: body.name,
      icon: body.icon
    }).returning();

    return {
      success: true,
      data: {
        ...result,
        deletedAt: result.deletedAt?.toISOString() ?? null
      }
    };
  }, {
    body: t.Object({
      name: t.String(),
      icon: t.Optional(t.String())
    })
  })
  .put('/:id', async ({ params, body, set }): Promise<ApiResponse<Category>> => {
    const id = parseInt(params.id);
    
    // Solo actualizamos los campos que fueron enviados
    const updateData: Partial<typeof categories.$inferInsert> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.icon !== undefined) updateData.icon = body.icon;

    if (Object.keys(updateData).length === 0) {
      set.status = 400;
      return { success: false, error: 'No fields provided for update' };
    }

    const [updated] = await db.update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();

    if (!updated) {
      set.status = 404;
      return { success: false, error: 'Category not found' };
    }

    return {
      success: true,
      data: {
        ...updated,
        deletedAt: updated.deletedAt?.toISOString() ?? null
      }
    };
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      name: t.Optional(t.String()),
      icon: t.Optional(t.String())
    })
  })
  .delete('/:id', async ({ params, set }): Promise<ApiResponse<{ id: number, type: 'soft' | 'hard' }>> => {
    const id = parseInt(params.id);
    
    // Check for transactions
    const transactionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.categoryId, id));

    const count = transactionCount[0]?.count ?? 0;

    if (count > 0) {
      // Soft delete
      await db.update(categories)
        .set({ deletedAt: new Date() })
        .where(eq(categories.id, id));
      
      return { success: true, data: { id, type: 'soft' } };
    } else {
      // Hard delete
      const result = await db.delete(categories)
        .where(eq(categories.id, id))
        .returning();

      if (result.length === 0) {
        set.status = 404;
        return { success: false, error: 'Category not found' };
      }

      return { success: true, data: { id, type: 'hard' } };
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  });
