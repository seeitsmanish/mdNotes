import { cache } from "react";
import { prisma } from "../db/prisma";
import { type AppSettings, DEFAULT_SETTINGS } from "../settings/schema";

/**
 * The one settings row (PRD R6.5). Reads are forgiving — a brand new database
 * has no row yet, and appearance must never be why the app fails to render.
 */

const SINGLETON = "singleton";

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({ where: { id: SINGLETON } });
  if (!row) return DEFAULT_SETTINGS;
  const { id: _id, updatedAt: _updatedAt, ...settings } = row;
  return settings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: patch,
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, ...patch },
  });
  const { id: _id, updatedAt: _updatedAt, ...settings } = row;
  return settings;
}

/**
 * One read per request: the root layout needs the appearance to render <html>
 * and the page needs it for the shell, and they should not query twice.
 */
export const getSettingsForRequest = cache(getSettings);
