import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 keeps the connection URL out of schema.prisma: the CLI reads it from
 * here, and the client gets it through a driver adapter (see lib/db/prisma.ts).
 *
 * Next loads .env for the app; the CLI does not, so it is loaded explicitly.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // No .env locally — fall back to whatever is already in the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx --env-file-if-exists=.env prisma/seed.ts",
  },
});
