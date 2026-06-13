import {setTimeout as sleep} from 'timers/promises';
import {getDiscordSessionLimitResetAt, waitForDiscordSessionLimitReset} from './discord-session-limit.js';

const INVALID_TOKEN_PATTERN = /invalid token|tokeninvalid|incorrect login details|401: unauthorized/i;
const TRANSIENT_PATTERN = /econnreset|econnrefused|etimedout|enotfound|socket hang up|fetch failed|timeout|502|503|504|network/i;

export function isInvalidDiscordTokenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return INVALID_TOKEN_PATTERN.test(message);
}

export function isTransientLoginError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_PATTERN.test(message);
}

export async function waitBeforeDiscordLoginRetry(error: unknown, attempt: number): Promise<void> {
  const resetAt = getDiscordSessionLimitResetAt(error);

  if (resetAt) {
    await waitForDiscordSessionLimitReset(resetAt);
    return;
  }

  const delayMs = Math.min(120_000, 10_000 * Math.min(attempt, 5));
  const reason = isTransientLoginError(error) ? 'transient network error' : 'login error';

  console.warn(
    `Discord ${reason} (attempt ${attempt}). `
    + `Retrying in ${Math.ceil(delayMs / 1000)}s instead of exiting (prevents Portainer crash-loops).`,
  );
  console.warn(error);

  await sleep(delayMs);
}
