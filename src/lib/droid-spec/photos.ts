import fs from 'fs/promises';
import path from 'path';
import {AttachmentBuilder, type Message} from 'discord.js';
import {DATA_DIR} from '../../services/config.js';
import {type PhotoKind, type SpecPhoto} from './state.js';

const MAX_BYTES = 8 * 1024 * 1024;

export function isImageMessage(message: Message): boolean {
  return [...message.attachments.values()].some(file => {
    const type = file.contentType ?? '';
    return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name ?? '');
  });
}

export async function storeChannelPhoto(
  channelId: string,
  kind: PhotoKind,
  message: Message,
): Promise<SpecPhoto | null> {
  const file = [...message.attachments.values()].find(item => {
    const type = item.contentType ?? '';
    return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(item.name ?? '');
  });
  if (!file?.url) {
    return null;
  }

  const res = await fetch(file.url);
  if (!res.ok) {
    return null;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return null;
  }

  const dir = path.join(DATA_DIR, 'spec-photos', channelId);
  await fs.mkdir(dir, {recursive: true});
  const ext = path.extname(file.name ?? '') || '.jpg';
  const storedName = `${String(Date.now())}-${kind}${ext}`;
  const storedPath = path.join(dir, storedName);
  await fs.writeFile(storedPath, buf);

  await message.delete().catch(() => undefined);

  return {kind, name: storedName, path: storedPath};
}

export function photoAttachments(photos: SpecPhoto[]): AttachmentBuilder[] {
  return photos.map(photo => new AttachmentBuilder(photo.path, {name: photo.name}));
}
