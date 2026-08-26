import path from 'path';
import {fileURLToPath} from 'url';
import {AttachmentBuilder} from 'discord.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets');

export const BANNER_NAME = 'droid-rollers-banner.jpg';
export const PLACEMENT_NAME = 'bb-placement.jpg';

export function bannerFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(ROOT, BANNER_NAME), {name: BANNER_NAME});
}

export function placementFile(): AttachmentBuilder {
  return new AttachmentBuilder(path.join(ROOT, PLACEMENT_NAME), {name: PLACEMENT_NAME});
}
