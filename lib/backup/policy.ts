/**
 * When the weekly backup and the trash clean-out happen (PRD §4.77). Pure:
 * there is no scheduler — the app asks on launch, and these decide.
 */

export const BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUPS_KEPT = 8;
export const TRASH_DAY_CHOICES = [0, 30] as const;

export function backupDue(last: Date | null, now = Date.now()): boolean {
  return last === null || now - last.getTime() >= BACKUP_EVERY_MS;
}

/** Trashed before this moment means gone for good; null when the clean-out is off. */
export function trashCutoff(days: number, now = Date.now()): Date | null {
  if (!Number.isInteger(days) || days <= 0) return null;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}
