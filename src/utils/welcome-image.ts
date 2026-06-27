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

interface MemberAvatarDraw {
  ctx: SKRSContext2D;
  member: GuildMember;
  avatarX: number;
  avatarY: number;
  avatarRadius: number;
  outerRing: string;
  innerRing: string;
}

async function drawMemberAvatar(options: MemberAvatarDraw): Promise<void> {
  const {ctx, member, avatarX, avatarY, avatarRadius, outerRing, innerRing} = options;
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
  const width = 960;
  const height = 320;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const pad = 36;
  const avatarSize = 112;
  const avatarRadius = avatarSize / 2;
  const avatarX = pad + avatarRadius;
  const avatarY = height / 2;
  const textX = pad + avatarSize + 32;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#121820');
  bg.addColorStop(0.55, '#0c1018');
  bg.addColorStop(1, '#070a0f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(pad, pad, 0, pad, pad, 420);
  glow.addColorStop(0, 'rgba(0, 136, 255, 0.22)');
  glow.addColorStop(0.45, 'rgba(0, 136, 255, 0.06)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = DROIDFIX.accentStripe;
  ctx.fillRect(0, height - 4, width, 4);

  try {
    const mark = await loadImage(path.join(ASSETS_ROOT, 'droidfix/controller-mark.png'));
    ctx.save();
    ctx.globalAlpha = 0.045;
    ctx.drawImage(mark, width - 300, height - 280, 260, 260);
    ctx.restore();
  } catch {
    // Optional asset
  }

  ctx.strokeStyle = 'rgba(0, 136, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 10, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 136, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 18, 0, Math.PI * 2);
  ctx.stroke();

  try {
    const avatarUrl = member.user.displayAvatarURL({extension: 'png', size: 256});
    const avatar = await loadImage(avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarSize, avatarSize);
    ctx.restore();
  } catch {
    ctx.fillStyle = '#152030';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  let logoEndX = textX;
  try {
    const logo = await loadImage(path.join(ASSETS_ROOT, 'droidfix/logo-square.png'));
    const logoSize = 44;
    ctx.drawImage(logo, textX, 52, logoSize, logoSize);
    logoEndX = textX + logoSize + 12;
  } catch {
    logoEndX = textX;
  }

  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = DROIDFIX.brandLight;
  ctx.fillText('WELCOME TO', logoEndX, 58);

  ctx.font = 'bold 44px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DROID', logoEndX, 104);
  const droidWidth = ctx.measureText('DROID').width;
  ctx.fillStyle = DROIDFIX.brand;
  ctx.fillText('FIX', logoEndX + droidWidth + 4, 104);

  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText('UK mail-in · Middlesbrough', logoEndX, 126);

  const displayName = member.displayName.slice(0, 32);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = DROIDFIX.text;
  ctx.fillText(displayName, textX, 178);

  ctx.font = '15px sans-serif';
  ctx.fillStyle = DROIDFIX.dim;
  ctx.fillText(`Member #${String(member.guild.memberCount)}`, textX, 206);

  let pillX = textX;
  for (const label of ['PS5', 'PS4', 'Xbox']) {
    pillX += drawTextPill(ctx, label, pillX, 232) + 8;
  }

  ctx.font = '600 12px sans-serif';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText('droidfix.uk · No fix, no fee · 90-day guarantee', textX, 278);

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
  await drawMemberAvatar({
    ctx,
    member,
    avatarX,
    avatarY,
    avatarRadius,
    outerRing: DROIDLAB.brand,
    innerRing: 'rgba(0, 180, 160, 0.4)',
  });

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
