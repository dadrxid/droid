import {setTimeout as sleep} from 'timers/promises';

const SESSION_LIMIT_PATTERN = /resets at ([0-9TZ.:+-]+)/i;

export function getDiscordSessionLimitResetAt(error: unknown): Date | null {
  const message = error instanceof Error ? error.message : String(error);

  if (!message.includes('Not enough sessions remaining')) {
    return null;
  }

  const match = SESSION_LIMIT_PATTERN.exec(message);
  if (!match) {
    return null;
  }

  const resetAt = new Date(match[1]);
  return Number.isNaN(resetAt.getTime()) ? null : resetAt;
}

export async function waitForDiscordSessionLimitReset(resetAt: Date): Promise<void> {
  const waitMs = resetAt.getTime() - Date.now() + 5_000;

  if (waitMs <= 0) {
    return;
  }

  const waitMinutes = Math.ceil(waitMs / 60_000);
  console.warn(
    'Discord session start limit reached (usually from crash-loop restarts). '
    + `Waiting ~${waitMinutes} minute(s) until ${resetAt.toISOString()} before reconnecting...`,
  );
  console.warn('Stop duplicate bot containers in Portainer while waiting.');

  await sleep(waitMs);
}
