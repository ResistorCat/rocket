import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { resolve, join } from 'path';
import type { ApiResponse, HealthCheck } from '@rocket/shared';
import { categoriesRoutes } from './routes/categories';
import { transactionsRoutes } from './routes/transactions';
import { financeRoutes } from './routes/finance';
import { chatRoutes } from './routes/chat';
import { toolsRoutes } from './routes/tools';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY. Define it in environment variables before starting the API.');
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite-preview';

const STATIC_DIR = resolve(import.meta.dir, '../../web/dist');

const app = new Elysia()
  .use(cors())
  .get('/health', (): ApiResponse<HealthCheck> => ({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      provider: `gemini:${GEMINI_MODEL}`,
    }
  }))
  .use(categoriesRoutes)
  .use(transactionsRoutes)
  .use(financeRoutes)
  .use(chatRoutes)
  .use(toolsRoutes)
  .use(
    await staticPlugin({
      assets: STATIC_DIR,
      prefix: '/',
    })
  )
  .get('/', () => Bun.file(join(STATIC_DIR, 'index.html')))
  .onError(({ set }) => {
    set.headers['content-type'] = 'text/html';
    return Bun.file(join(STATIC_DIR, 'index.html'));
  })
  .listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
