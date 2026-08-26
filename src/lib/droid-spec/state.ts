export type PhotoKind = 'shell' | 'faces' | 'backs' | 'other';
export type SpecPage = 'core' | 'look' | 'bb' | 'photos';
export type BbSide = 'Left' | 'Right';

export interface SpecPhoto {
  kind: PhotoKind;
  name: string;
  path: string;
}

export interface BbSlot {
  height: string;
  side: BbSide;
}

export interface DroidSpec {
  ownerId: string;
  page: SpecPage;
  board: string;
  sticks: string;
  caps: string;
  shell: string;
  shellNote: string;
  faces: string;
  backs: string;
  click: string;
  bbCount: string;
  bbCursor: number;
  bbSlots: BbSlot[];
  photos: SpecPhoto[];
  extras: string[];
  startMessageId: string;
}

export const FACE_DROID_ROLLERS_STANDARD = 'Droid Rollers Standard (resin PlayStation icons)';
export const FACE_XBOX_PS = 'Xbox shape · PlayStation icons';
export const FACE_XBOX_ABXY = 'Xbox shape · Xbox icons (ABXY)';
export const FACE_XBOX_MEMBRANE = 'Xbox style (membrane only)';
export const FACE_STOCK_MEMBRANE = 'Stock (membrane only)';
export const FACE_STOCK_WHITE_MEMBRANE = 'Stock white (membrane only)';
export const CLICK_FACES = 'Faces + triggers (Droid Rollers Standard)';
export const BACKS_BB = 'Battle Beaver style';
export const SHELL_SOFT_TOUCH = 'Soft Touch Shell';
export const SHELL_GHOST = 'ExtremeRate Ghost';
export const CAPS_OEM = 'OEM';

export function emptySpec(): DroidSpec {
  return {
    ownerId: '',
    page: 'core',
    board: '',
    sticks: '',
    caps: '',
    shell: '',
    shellNote: '',
    faces: '',
    backs: '',
    click: '',
    bbCount: '',
    bbCursor: 0,
    bbSlots: [],
    photos: [],
    extras: [],
    startMessageId: '',
  };
}

const byChannel = new Map<string, DroidSpec>();

export function getSpec(channelId: string): DroidSpec {
  let spec = byChannel.get(channelId);
  if (!spec) {
    spec = emptySpec();
    byChannel.set(channelId, spec);
  }
  if (!Array.isArray(spec.extras)) spec.extras = [];

  return spec;
}

export function resetSpec(channelId: string): DroidSpec {
  const spec = emptySpec();
  byChannel.set(channelId, spec);
  return spec;
}

export function isBb(spec: DroidSpec): boolean {
  return spec.backs === BACKS_BB;
}

export function isSoftTouch(spec: DroidSpec): boolean {
  return spec.shell === SHELL_SOFT_TOUCH;
}

export function isGhost(spec: DroidSpec): boolean {
  return spec.shell === SHELL_GHOST;
}

export function isLeadjoyCap(caps: string): boolean {
  return caps.startsWith('Leadjoy Magic');
}

/** Ghost analog well: Leadjoy Magic n1 and n2 do not fit. Stock caps only. */
export function lockGhostCaps(spec: DroidSpec): void {
  if (isGhost(spec) && isLeadjoyCap(spec.caps)) {
    spec.caps = CAPS_OEM;
  }
}

export function hasPhoto(spec: DroidSpec, kind: PhotoKind): boolean {
  return spec.photos.some(photo => photo.kind === kind);
}

export function syncBbSlots(spec: DroidSpec): void {
  const count = Number.parseInt(spec.bbCount, 10);
  if (!Number.isFinite(count) || count < 1) {
    spec.bbSlots = [];
    spec.bbCursor = 0;
    return;
  }

  spec.bbSlots = spec.bbSlots.slice(0, count);
  while (spec.bbSlots.length < count) {
    spec.bbSlots.push({height: '', side: 'Left'});
  }

  const firstEmpty = spec.bbSlots.findIndex(slot => !slot.height);
  spec.bbCursor = firstEmpty === -1 ? Math.max(0, count - 1) : firstEmpty;
}

export function applyBbPick(spec: DroidSpec, raw: string): void {
  const [height, side] = raw.split('|');
  if (!height || (side !== 'Left' && side !== 'Right')) {
    return;
  }

  syncBbSlots(spec);
  const slot = spec.bbSlots[spec.bbCursor];
  if (!slot) {
    return;
  }

  slot.height = height;
  slot.side = side;
  if (spec.bbCursor < spec.bbSlots.length - 1) {
    spec.bbCursor += 1;
  }
}

export function photoKindLabel(kind: PhotoKind): string {
  if (kind === 'shell') {
    return 'Shell';
  }

  if (kind === 'faces') {
    return 'Faces';
  }

  if (kind === 'backs') {
    return 'Backs';
  }

  return 'Other';
}

export function placementLine(spec: DroidSpec): string {
  if (!isBb(spec)) {
    return '';
  }

  if (spec.bbSlots.length === 0) {
    return '**Placements:** pick how many, then tick each button';
  }

  return spec.bbSlots
    .map((slot, index) => {
      const mark = slot.height ? `${slot.height} · ${slot.side}` : 'not set';
      return `**${index + 1}.** ${mark}`;
    })
    .join('\n');
}

export function specText(spec: DroidSpec): string {
  const lines = [
    `**Board:** ${spec.board || 'not set'}`,
    `**Sticks:** ${spec.sticks || 'not set'}`,
    `**Caps:** ${spec.caps || 'not set'}`,
    `**Shell:** ${spec.shell || 'not set'}${isSoftTouch(spec) && spec.shellNote ? ` (${spec.shellNote})` : ''}`,
    `**Faces:** ${spec.faces || 'not set'}`,
    `**Backs:** ${spec.backs || 'not set'}`,
  ];

  if (isBb(spec)) {
    lines.push(`**BB count:** ${spec.bbCount || 'not set'}`);
    lines.push(placementLine(spec));
  }

  lines.push(`**Click:** ${spec.click || 'not set'}`);
  if (spec.extras.length > 0) {
    lines.push(`**Extras:** ${spec.extras.join(', ')}`);
  }
  if (spec.photos.length > 0) {
    lines.push(`**Photos:** ${spec.photos.map(photo => photoKindLabel(photo.kind)).join(', ')}`);
  } else {
    lines.push('**Photos:** none');
  }

  return lines.join('\n');
}
