import { prisma } from "./prisma";

/** Whether the database answers at all (PRD §4.32). */
export async function databaseAnswers(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
