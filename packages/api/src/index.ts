import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { resolve, join } from 'path';
import type { ApiResponse, HealthCheck } from '@rocket/shared';

const STATIC_DIR = resolve(import.meta.dir, '../../web/dist');

const app = new Elysia()
  .use(cors())
  .get('/health', (): ApiResponse<HealthCheck> => ({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  }))
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
