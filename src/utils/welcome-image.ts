import {AttachmentBuilder, GuildMember} from 'discord.js';
import {createCanvas, loadImage, SKRSContext2D} from '@napi-rs/canvas';
import path from 'path';
import {fileURLToPath} from 'url';

export type WelcomeTheme = 'droidlab' | 'droidfix';

const ASSETS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/welcome',
);

const DROIDFIX = {
  brand: '#0088ff',
  brandLight: '#4db2ff',
  brandDark: '#0066cc',
  accentStripe: '#0088ff',
  warmBg: '#0c1018',
  panel: '#111822',
  panelEdge: 'rgba(255, 255, 255, 0.06)',
  receiptLine: 'rgba(255, 255, 255, 0.035)',
  text: '#f4f7fb',
  muted: '#8fa3b8',
  dim: '#4a5d72',
  pillBg: 'rgba(0, 136, 255, 0.14)',
  pillText: '#9fd0ff',
} as const;

const DROIDLAB = {
  brand: '#00d4ff',
  accent: '#00b4a0',
  grid: 'rgba(0, 212, 255, 0.04)',
  border: 'rgba(0, 212, 255, 0.12)',
  bracket: 'rgba(0, 212, 255, 0.2)',
  background: '#060d12',
  text: '#c8e8f0',
  muted: '#5a8a9a',
  dim: '#2a4a5a',
  footer: '#1e3a4a',
} as const;

async function drawRoundedMemberAvatar(
  ctx: SKRSContext2D,
  member: GuildMember,
  x: number,
  y: number,
  size: number,
  radius: number,
): Promise<void> {
  const drawRoundedRect = (px: number, py: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + w - r, py);
    ctx.quadraticCurveTo(px + w, py, px + w, py + r);
    ctx.lineTo(px + w, py + h - r);
    ctx.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    ctx.lineTo(px + r, py + h);
    ctx.quadraticCurveTo(px, py + h, px, py + h - r);
    ctx.lineTo(px, py + r);
    ctx.quadraticCurveTo(px, py, px + r, py);
    ctx.closePath();
  };

  ctx.strokeStyle = DROIDFIX.brand;
  ctx.lineWidth = 2;
  drawRoundedRect(x - 2, y - 2, size + 4, size + 4, radius + 2);
  ctx.stroke();

  try {
    const avatarUrl = member.user.displayAvatarURL({extension: 'png', size: 128});
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    drawRoundedRect(x, y, size, size, radius);
    ctx.clip();
    ctx.drawImage(avatar, x, y, size, size);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#152030';
    drawRoundedRect(x, y, size, size, radius);
    ctx.fill();
  }
}

function drawDroidfixReceiptLines(ctx: SKRSContext2D, width: number, height: number, startX: number): void {
  ctx.strokeStyle = DROIDFIX.receiptLine;
  ctx.lineWidth = 1;

  for (let y = 54; y < height - 36; y += 28) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(width - 36, y);
    ctx.stroke();
  }
}

function drawDroidfixAccentStripe(ctx: SKRSContext2D, height: number): void {
  const stripe = ctx.createLinearGradient(0, 0, 0, height);
  stripe.addColorStop(0, DROIDFIX.brandLight);
  stripe.addColorStop(0.5, DROIDFIX.accentStripe);
  stripe.addColorStop(1, DROIDFIX.brandDark);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 0, 8, height);
}

function drawTextPill(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
): number {
  ctx.font = 'bold 10px sans-serif';
  const paddingX = 10;
  const width = ctx.measureText(text).width + (paddingX * 2);
  const height = 20;

  ctx.fillStyle = DROIDFIX.pillBg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();

  ctx.fillStyle = DROIDFIX.pillText;
  ctx.fillText(text, x + paddingX, y + 14);
  return width;
}

export async function generateWelcomeImage(
  member: GuildMember,
  theme: WelcomeTheme,
): Promise<AttachmentBuilder> {
  if (theme === 'droidfix') {
    return generateDroidfixWelcome(member);
  }

  return generateDroidlabWelcome(member);
}

async function drawMemberAvatar(
  ctx: SKRSContext2D,
  member: GuildMember,
  avatarX: number,
  avatarY: number,
  avatarRadius: number,
  outerRing: string,
  innerRing: string,
): Promise<void> {
  ctx.strokeStyle = outerRing;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = innerRing;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
  ctx.stroke();

  try {
    const avatarUrl = member.user.displayAvatarURL({extension: 'png', size: 128});
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(
      avatar,
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2,
    );
    ctx.restore();
  } catch {
    ctx.fillStyle = '#0a1520';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGrid(ctx: SKRSContext2D, width: number, height: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;

  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBrackets(ctx: SKRSContext2D, width: number, height: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;

  ctx.beginPath();
  ctx.moveTo(24, 40);
  ctx.lineTo(24, height - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 40);
  ctx.lineTo(44, 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, height - 40);
  ctx.lineTo(44, height - 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width - 24, 40);
  ctx.lineTo(width - 24, height - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width - 24, 40);
  ctx.lineTo(width - 44, 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width - 24, height - 40);
  ctx.lineTo(width - 44, height - 40);
  ctx.stroke();
}

async function generateDroidfixWelcome(member: GuildMember): Promise<AttachmentBuilder> {
  const width = 900;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const contentX = 40;
  const avatarSize = 96;
  const avatarX = width - avatarSize - 44;
  const avatarY = (height - avatarSize) / 2;

  ctx.fillStyle = DROIDFIX.warmBg;
  ctx.fillRect(0, 0, width, height);

  drawDroidfixAccentStripe(ctx, height);

  ctx.fillStyle = DROIDFIX.panel;
  ctx.fillRect(8, 16, width - 24, height - 32);
  ctx.strokeStyle = DROIDFIX.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(8.5, 16.5, width - 25, height - 33);

  drawDroidfixReceiptLines(ctx, width, height, contentX);

  try {
    const mark = await loadImage(path.join(ASSETS_ROOT, 'droidfix/controller-mark.png'));
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(mark, width - 280, 24, 220, 220);
    ctx.restore();
  } catch {
    // Optional asset
  }

  let pillX = contentX;
  pillX += drawTextPill(ctx, 'UK MAIL-IN', pillX, 34) + 10;
  pillX += drawTextPill(ctx, 'CONTROLLER REPAIR', pillX, 34) + 10;
  drawTextPill(ctx, '90-DAY GUARANTEE', pillX, 34);

  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DROID', contentX, 98);
  const droidWidth = ctx.measureText('DROID').width;
  ctx.fillStyle = DROIDFIX.brand;
  ctx.fillText('FIX', contentX + droidWidth + 3, 98);

  ctx.font = '600 14px sans-serif';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText('Solo repair shop · Middlesbrough · UK', contentX, 122);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = DROIDFIX.text;
  ctx.fillText('Glad you made it.', contentX, 168);

  const displayName = member.displayName.slice(0, 28);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = DROIDFIX.text;
  ctx.fillText(displayName, contentX, 198);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = DROIDFIX.dim;
  ctx.fillText(`Member #${member.guild.memberCount}`, contentX, 222);

  let platformX = contentX;
  for (const label of ['PS5', 'PS4', 'Xbox Series']) {
    platformX += drawTextPill(ctx, label, platformX, 248) + 8;
  }

  ctx.font = '12px sans-serif';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText('No fix, no fee · postage both ways', contentX, 284);

  await drawRoundedMemberAvatar(ctx, member, avatarX, avatarY, avatarSize, 18);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, {name: 'welcome-droidfix.png'});
}

async function generateDroidlabWelcome(member: GuildMember): Promise<AttachmentBuilder> {
  const width = 900;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = DROIDLAB.background;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, width, height, DROIDLAB.grid);

  const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, 300);
  glow.addColorStop(0, 'rgba(0, 180, 160, 0.07)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = DROIDLAB.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  drawBrackets(ctx, width, height, DROIDLAB.bracket);

  const avatarX = 100;
  const avatarY = height / 2;
  const avatarRadius = 55;
  await drawMemberAvatar(
    ctx,
    member,
    avatarX,
    avatarY,
    avatarRadius,
    DROIDLAB.brand,
    'rgba(0, 180, 160, 0.4)',
  );

  const textX = 190;

  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('droid', textX, 110);
  const droidWidth = ctx.measureText('droid').width;
  ctx.fillStyle = DROIDLAB.brand;
  ctx.fillText('lab', textX + droidWidth, 110);

  ctx.fillStyle = DROIDLAB.accent;
  ctx.beginPath();
  ctx.arc(textX + droidWidth + ctx.measureText('lab').width + 10, 100, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(textX, 125);
  ctx.lineTo(580, 125);
  ctx.stroke();

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = DROIDLAB.text;
  ctx.fillText('You\'ve connected.', textX, 165);

  ctx.font = '14px monospace';
  ctx.fillStyle = DROIDLAB.muted;
  ctx.fillText(`> ${member.user.username}`, textX, 195);

  ctx.font = '12px monospace';
  ctx.fillStyle = DROIDLAB.dim;
  ctx.fillText(`member #${member.guild.memberCount}`, textX, 220);

  ctx.font = '11px monospace';
  ctx.fillStyle = DROIDLAB.footer;
  ctx.fillText('// droidlab.org · zimaos', textX, 265);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, {name: 'welcome-droidlab.png'});
}
