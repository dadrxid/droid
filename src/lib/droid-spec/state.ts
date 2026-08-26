import {defaultBoard, defaultBuild, itemLabel} from './menu.js';

export type PhotoKind = 'shell' | 'faces' | 'backs' | 'other';
export type SpecPage = 'core' | 'look' | 'mods' | 'bb' | 'photos';
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
  build: string;
  board: string;
  sticks: string;
  caps: string;
  tension: string;
  shell: string;
  shellNote: string;
  rear: string;
  faces: string;
  backs: string;
  click: string;
  shoulders: string;
  bbCount: string;
  bbCursor: number;
  bbSlots: BbSlot[];
  photos: SpecPhoto[];
  extras: string[];
  startMessageId: string;
}

export const CAPS_OEM = 'caps-oem';
export const FACES_RESIN = 'faces-resin';
export const CLICK_FACES = 'click-faces';
export const BACKS_BB = 'backs-bb';

/** Not price desk rows. They let the customer clear an optional group. */
export const TENSION_NONE = 'tension-none';
export const SHOULDERS_NONE = 'shoulders-none';

export function emptySpec(): DroidSpec {
  return {
    ownerId: '',
    page: 'core',
    build: '',
    board: '',
    sticks: '',
    caps: '',
    tension: '',
    shell: '',
    shellNote: '',
    rear: '',
    faces: '',
    backs: '',
    click: '',
    shoulders: '',
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

  if (!Array.isArray(spec.extras)) {
    spec.extras = [];
  }

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
  return spec.shell === 'shell-soft';
}

export function isRearSoftTouch(spec: DroidSpec): boolean {
  return spec.rear === 'rear-soft';
}

/** Themed shells are built to a photo, so the sheet asks for one. */
export function isBo5(spec: DroidSpec): boolean {
  return spec.shell === 'shell-bo5';
}

export function needsShellColour(spec: DroidSpec): boolean {
  return isSoftTouch(spec) || isRearSoftTouch(spec);
}

export function isGhost(spec: DroidSpec): boolean {
  return spec.shell === 'shell-ghost';
}

export function isLeadjoyCap(caps: string): boolean {
  return caps === 'caps-leadjoy';
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

function buildLine(spec: DroidSpec): string {
  if (spec.build) {
    return `**Build:** ${itemLabel(spec.build)}`;
  }

  const build = defaultBuild();
  return build ? `**Build:** ${build.label}` : '**Build:** not set';
}

function boardLine(spec: DroidSpec): string {
  if (spec.board) {
    return `**Board:** ${itemLabel(spec.board)}`;
  }

  const board = defaultBoard();
  return board ? `**Board:** ${board.label} (default)` : '**Board:** not set';
}

function pick(spec: DroidSpec, field: keyof DroidSpec, label: string): string {
  const value = spec[field];
  const text = typeof value === 'string' && value ? itemLabel(value) : 'not set';
  return `**${label}:** ${text}`;
}

export function specText(spec: DroidSpec): string {
  const colour = spec.shellNote ? ` (${spec.shellNote})` : '';
  const lines = [
    buildLine(spec),
    boardLine(spec),
    pick(spec, 'sticks', 'Sticks'),
    pick(spec, 'caps', 'Caps'),
  ];

  if (spec.tension && spec.tension !== TENSION_NONE) {
    lines.push(pick(spec, 'tension', 'Stick tension'));
  }

  lines.push(
    `${pick(spec, 'shell', 'Front shell')}${isSoftTouch(spec) ? colour : ''}`,
    `${pick(spec, 'rear', 'Rear shell')}${isRearSoftTouch(spec) ? colour : ''}`,
    pick(spec, 'faces', 'Face buttons'),
    pick(spec, 'click', 'Button style'),
    pick(spec, 'backs', 'Back buttons'),
  );

  if (isBb(spec)) {
    lines.push(`**How many:** ${spec.bbCount || 'not set'}`);
    lines.push(placementLine(spec));
  }

  if (spec.shoulders && spec.shoulders !== SHOULDERS_NONE) {
    lines.push(pick(spec, 'shoulders', 'Shoulder buttons'));
  }

  if (spec.extras.length > 0) {
    lines.push(`**Extras:** ${spec.extras.map(id => itemLabel(id)).join(', ')}`);
  }

  if (spec.photos.length > 0) {
    lines.push(`**Photos:** ${spec.photos.map(photo => photoKindLabel(photo.kind)).join(', ')}`);
  } else {
    lines.push('**Photos:** none');
  }

  return lines.join('\n');
}
