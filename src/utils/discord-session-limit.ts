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
    console.warn('Discord session limit reset time has passed — retrying login now.');
    return;
  }

  const waitMinutes = Math.ceil(waitMs / 60_000);
  console.warn(
    'Discord session start limit reached (usually from crash-loop restarts). '
    + `Waiting ~${waitMinutes} minute(s) until ${resetAt.toISOString()} before reconnecting...`,
  );
  console.warn('Bot stays online in Discord only after login succeeds — container may show "running" while waiting.');
  console.warn('If using Portainer, set restart policy to "on failure" (not "unless stopped") to avoid Discord session limits.');

  const heartbeatMs = 10 * 60_000;
  let remainingMs = waitMs;

  while (remainingMs > 0) {
    const sleepMs = Math.min(heartbeatMs, remainingMs);
    // eslint-disable-next-line no-await-in-loop -- intentional wait with periodic heartbeat
    await sleep(sleepMs);
    remainingMs -= sleepMs;

    if (remainingMs > 0) {
      console.warn(`Still waiting for Discord session limit reset (~${Math.ceil(remainingMs / 60_000)} min left)...`);
    }
  }
}
