export type PhotoKind = 'shell' | 'faces' | 'backs' | 'other';

export interface SpecPhoto {
  kind: PhotoKind;
  url: string;
  name: string;
}

export interface DroidSpec {
  board: string;
  sticks: string;
  caps: string;
  shell: string;
  shellNote: string;
  faces: string;
  backs: string;
  bbCount: string;
  bbPlace: string;
  bbNote: string;
  click: string;
  photos: SpecPhoto[];
  formMessageId: string;
  extraMessageId: string;
}

export function emptySpec(): DroidSpec {
  return {
    board: '',
    sticks: '',
    caps: '',
    shell: '',
    shellNote: '',
    faces: '',
    backs: '',
    bbCount: '2',
    bbPlace: '',
    bbNote: '',
    click: '',
    photos: [],
    formMessageId: '',
    extraMessageId: '',
  };
}

const byChannel = new Map<string, DroidSpec>();

export function getSpec(channelId: string): DroidSpec {
  let spec = byChannel.get(channelId);
  if (!spec) {
    spec = emptySpec();
    byChannel.set(channelId, spec);
  }

  return spec;
}

export function setSpec(channelId: string, spec: DroidSpec): void {
  byChannel.set(channelId, spec);
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

export function specText(spec: DroidSpec): string {
  const lines = [
    `**Board:** ${spec.board || 'not set'}`,
    `**Sticks:** ${spec.sticks || 'not set'}`,
    `**Caps:** ${spec.caps || 'not set'}`,
    `**Shell:** ${spec.shell || 'not set'}${spec.shellNote ? ` (${spec.shellNote})` : ''}`,
    `**Faces:** ${spec.faces || 'not set'}`,
    `**Backs:** ${spec.backs || 'not set'}`,
  ];
  if (spec.backs.includes('Battle Beaver')) {
    lines.push(`**BB count:** ${spec.bbCount || 'not set'}`);
    lines.push(`**BB where:** ${spec.bbPlace || 'not set'}${spec.bbNote ? ` · ${spec.bbNote}` : ''}`);
  }

  lines.push(`**Click:** ${spec.click || 'not set'}`);
  if (spec.photos.length > 0) {
    lines.push(`**Photos:** ${spec.photos.map(photo => photoKindLabel(photo.kind)).join(', ')}`);
  } else {
    lines.push('**Photos:** none');
  }

  return lines.join('\n');
}
