import 'dotenv/config';
import { z } from 'zod';
import { buildApp } from './app.js';

const envSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
  DATABASE_PATH: z.string().min(1).optional(),
  CATALOG_PATH: z.string().min(1).optional(),
});

async function main(): Promise<void> {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    throw new Error(`Invalid server configuration: ${env.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  process.env.CORS_ORIGINS = env.data.CORS_ORIGINS;
  if (env.data.DATABASE_PATH) process.env.DATABASE_PATH = env.data.DATABASE_PATH;
  if (env.data.CATALOG_PATH) process.env.CATALOG_PATH = env.data.CATALOG_PATH;
  const app = await buildApp();
  await app.listen({ host: env.data.HOST, port: env.data.PORT });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().catch((error: unknown) => {
        app.log.error({ err: error }, 'Failed to close the API server cleanly');
        process.exitCode = 1;
      });
    });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Failed to start APIverse API server.');
  process.exitCode = 1;
});
