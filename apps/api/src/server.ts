import Fastify from 'fastify';
import { getConfiguredRoots } from './config';
import type { ServerOptions } from './types';
import { registerProjectRoutes } from './routes/projects';
import { registerWikiRoutes } from './routes/wiki';
import { registerSearchRoutes } from './routes/search';

declare module 'fastify' {
  interface FastifyInstance {
    wikiRoots: string[];
  }
}

export function buildServer(options?: Partial<ServerOptions>) {
  const app = Fastify({ logger: false });
  app.decorate('wikiRoots', getConfiguredRoots(options?.roots));

  app.register(registerProjectRoutes, { prefix: '/api' });
  app.register(registerWikiRoutes, { prefix: '/api' });
  app.register(registerSearchRoutes, { prefix: '/api' });

  return app;
}

async function main() {
  const app = buildServer();
  await app.listen({ host: '127.0.0.1', port: 8787 });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
