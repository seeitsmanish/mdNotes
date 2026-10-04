/** A share link's token (PRD §4.68): 16 random bytes as base64url. Checked before any lookup. */
export const SHARE_TOKEN = /^[A-Za-z0-9_-]{22}$/;
