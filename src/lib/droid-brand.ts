import type {Guild} from 'discord.js';

/**
 * DroidFix branding for Discord messages. The emoji is looked up by name rather
 * than by a hardcoded ID so re-uploading it in the server keeps working, and
 * every helper degrades to plain text when the emoji or icon is missing.
 */

const BRAND_EMOJI_NAMES = ['droidrollers', 'droidfix'];

export function brandEmoji(guild: Guild | null | undefined): string {
  if (!guild) {
    return '';
  }

  for (const name of BRAND_EMOJI_NAMES) {
    const found = guild.emojis.cache.find(emoji => emoji.name?.toLowerCase() === name);
    if (found) {
      return found.toString();
    }
  }

  return '';
}

export function brandLogo(guild: Guild | null | undefined): string | undefined {
  return guild?.iconURL({size: 256}) ?? undefined;
}

/** Prefixes text with the brand emoji when the server has one. */
export function branded(emoji: string, text: string): string {
  return emoji ? `${emoji} ${text}` : text;
}
