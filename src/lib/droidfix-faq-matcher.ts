import {DroidfixFaqEntry} from './droidfix-faq-entries.js';

const MIN_SCORE = 45;

/** Common misspellings and shorthand seen in Discord support channels. */
const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bxb1\b/g, 'xbox one'],
  [/\bxbone\b/g, 'xbox one'],
  [/\bxboxone\b/g, 'xbox one'],
  [/\bxbox\s*360\b/g, 'xbox one'],
  [/\bdualsence\b/g, 'dualsense'],
  [/\bdual\s*sence\b/g, 'dualsense'],
  [/\bdualshok\b/g, 'dualshock'],
  [/\bdual\s*shok\b/g, 'dualshock'],
  [/\bstickdrift\b/g, 'stick drift'],
  [/\bstick\s*drif+\b/g, 'stick drift'],
  [/\bdrif+\b/g, 'drift'],
  [/\bmailin\b/g, 'mail in'],
  [/\bwont\b/g, 'won t charge'],
  [/\bwon't\b/g, 'won t charge'],
  [/\bcant\b/g, 'cannot'],
  [/\bcannot\b/g, 'cannot'],
  [/\bdont\b/g, 'do not'],
  [/\bdf\s*s\b/g, 'df-s'],
  [/\bjdm040\b/g, 'jdm-040'],
  [/\bjdm050\b/g, 'jdm-050'],
  [/\bjdm055\b/g, 'jdm-055'],
  [/\bjdm001\b/g, 'jdm-001'],
  [/\bjdm011\b/g, 'jdm-011'],
  [/\bjdm020\b/g, 'jdm-020'],
  [/\bjdm030\b/g, 'jdm-030'],
  [/\bcuhzct1\b/g, 'cuh-zct1'],
  [/\bcuhzct2\b/g, 'cuh-zct2'],
  [/\bturn\s*around\b/g, 'turnaround'],
  [/\bpostage\s*both\s*ways\b/g, 'postage both ways'],
  [/\btrack\s*my\b/g, 'track order'],
  [/\bhow\s*long\s*does\b/g, 'how long'],
  [/\brepair\s*time\b/g, 'turnaround'],
  [/\bthirdparty\b/g, 'third party'],
  [/\b3rd\s*party\b/g, 'third party'],
  [/\bps4v1\b/g, 'ps4 v1'],
  [/\bps4\s*v\s*1\b/g, 'ps4 v1'],
  [/\bmodel\s*1914\b/g, '1914'],
  [/\belite\s*2\b/g, 'elite series 2'],
];

const SHORT_PLATFORM_TOKENS = new Set([
  'ps4', 'ps5', 'xbox', 'jdm', 'bdm', '1914', 'xb1', 'df-s', 'dfs', 'drift',
]);

export function normalizeFaqInput(text: string): string {
  let normalized = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const row = Array.from({length: b.length + 1}, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    row[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + cost,
      );
      prev = temp;
    }
  }

  return row[b.length] ?? 0;
}

function fuzzyWordMatch(messageWords: string[], trigger: string): boolean {
  if (trigger.length < 4) {
    return false;
  }

  const maxDistance = trigger.length <= 5 ? 1 : 2;

  return messageWords.some(word => {
    if (word.length < 3) {
      return false;
    }

    return levenshtein(word, trigger) <= maxDistance;
  });
}

function scoreTrigger(normalized: string, messageWords: string[], trigger: string): number {
  const normalizedTrigger = normalizeFaqInput(trigger);

  if (!normalizedTrigger) {
    return 0;
  }

  if (normalized.includes(normalizedTrigger)) {
    return 55 + normalizedTrigger.length;
  }

  const triggerWords = normalizedTrigger.split(/\s+/).filter(Boolean);

  if (triggerWords.length === 1 && fuzzyWordMatch(messageWords, triggerWords[0]!)) {
    return 48 + triggerWords[0]!.length;
  }

  if (triggerWords.length > 1) {
    const matchedWords = triggerWords.filter(word =>
      normalized.includes(word) || fuzzyWordMatch(messageWords, word),
    );

    if (matchedWords.length === triggerWords.length) {
      return 42 + matchedWords.join(' ').length;
    }

    if (matchedWords.length >= Math.ceil(triggerWords.length / 2) && matchedWords.length >= 2) {
      return 35 + matchedWords.join(' ').length;
    }
  }

  return 0;
}

function scoreEntry(entry: DroidfixFaqEntry, normalized: string, raw: string): number {
  let score = 0;
  const rawLower = raw.toLowerCase();
  const messageWords = normalized.split(/\s+/).filter(Boolean);

  for (const pattern of entry.patterns ?? []) {
    if (pattern.test(rawLower)) {
      score += 100;
    }
  }

  for (const trigger of entry.triggers) {
    score += scoreTrigger(normalized, messageWords, trigger);
  }

  if (entry.requireAll?.length) {
    const allPresent = entry.requireAll.every(keyword => {
      const normalizedKeyword = normalizeFaqInput(keyword);
      return normalized.includes(normalizedKeyword)
        || fuzzyWordMatch(messageWords, normalizedKeyword);
    });

    if (!allPresent) {
      return 0;
    }

    score += 38;
  }

  if (entry.requireAny?.length) {
    const anyPresent = entry.requireAny.some(keyword => {
      const normalizedKeyword = normalizeFaqInput(keyword);
      return normalized.includes(normalizedKeyword)
        || fuzzyWordMatch(messageWords, normalizedKeyword);
    });

    if (!anyPresent) {
      return 0;
    }

    score += 28;
  }

  return score;
}

function isTooShort(normalized: string): boolean {
  if (normalized.length >= 4) {
    return false;
  }

  const token = normalized.replace(/\s/g, '');
  return !SHORT_PLATFORM_TOKENS.has(token);
}

export function matchDroidfixFaq(message: string, entries: readonly DroidfixFaqEntry[]): DroidfixFaqEntry | null {
  const raw = message.trim();

  if (!raw || raw.startsWith('/')) {
    return null;
  }

  const normalized = normalizeFaqInput(raw);

  if (isTooShort(normalized)) {
    return null;
  }

  let best: {entry: DroidfixFaqEntry; score: number} | null = null;

  for (const entry of entries) {
    const score = scoreEntry(entry, normalized, raw);

    if (score >= MIN_SCORE && (!best || score > best.score)) {
      best = {entry, score};
    }
  }

  return best?.entry ?? null;
}
