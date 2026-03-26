import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import type { ApiResponse, HealthCheck } from '@rocket/shared';

const app = new Elysia()
  .use(cors())
  .get('/', () => 'Hello Elysia')
  .get('/health', (): ApiResponse<HealthCheck> => ({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  }))
  .listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
