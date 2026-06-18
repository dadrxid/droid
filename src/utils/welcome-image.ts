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
  brandGlow: 'rgba(0, 136, 255, 0.22)',
  grid: 'rgba(0, 136, 255, 0.045)',
  border: 'rgba(0, 136, 255, 0.14)',
  bracket: 'rgba(0, 136, 255, 0.24)',
  background: '#070910',
  text: '#eef4ff',
  muted: '#6b8299',
  dim: '#2a3d52',
  footer: '#1a2838',
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

export function welcomeMessageForTheme(theme: WelcomeTheme, member: GuildMember): string {
  if (theme === 'droidfix') {
    return `Welcome to **DroidFix UK**, <@${member.id}>. Check the pins in INFO HUB, or ask in ❓・ᴀꜱᴋ · https://droidfix.uk`;
  }

  return `Hey <@${member.id}>, you're in.`;
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

function drawBottomSweep(ctx: SKRSContext2D, width: number, height: number, brand: string, brandLight: string): void {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.35, brand);
  gradient.addColorStop(0.5, brandLight);
  gradient.addColorStop(0.65, brand);
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - 2, width, 2);
}

async function generateDroidfixWelcome(member: GuildMember): Promise<AttachmentBuilder> {
  const width = 900;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = DROIDFIX.background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(0, height / 2, 0, 0, height / 2, 420);
  glow.addColorStop(0, DROIDFIX.brandGlow);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  drawGrid(ctx, width, height, DROIDFIX.grid);

  ctx.strokeStyle = DROIDFIX.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  drawBrackets(ctx, width, height, DROIDFIX.bracket);
  drawBottomSweep(ctx, width, height, DROIDFIX.brand, DROIDFIX.brandLight);

  const avatarX = 100;
  const avatarY = height / 2;
  const avatarRadius = 55;
  await drawMemberAvatar(
    ctx,
    member,
    avatarX,
    avatarY,
    avatarRadius,
    DROIDFIX.brand,
    'rgba(0, 136, 255, 0.35)',
  );

  const textX = 190;

  ctx.font = 'bold 38px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('DROID', textX, 102);
  const droidWidth = ctx.measureText('DROID').width;
  ctx.fillStyle = DROIDFIX.brand;
  ctx.fillText('FIX', textX + droidWidth + 2, 102);

  ctx.font = '600 13px sans-serif';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText('Controller repair · UK mail-in', textX, 126);

  ctx.strokeStyle = 'rgba(0, 136, 255, 0.22)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(textX, 138);
  ctx.lineTo(560, 138);
  ctx.stroke();

  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = DROIDFIX.text;
  ctx.fillText('Welcome aboard.', textX, 168);

  ctx.font = '14px monospace';
  ctx.fillStyle = DROIDFIX.muted;
  ctx.fillText(`> ${member.user.username}`, textX, 196);

  ctx.font = '12px monospace';
  ctx.fillStyle = DROIDFIX.dim;
  ctx.fillText(`member #${member.guild.memberCount}`, textX, 220);

  ctx.font = '11px monospace';
  ctx.fillStyle = DROIDFIX.footer;
  ctx.fillText('droidfix.uk · PS5 · PS4 · Xbox Series X|S', textX, 262);

  try {
    const mark = await loadImage(path.join(ASSETS_ROOT, 'droidfix/controller-mark.png'));
    const markSize = 72;
    const markX = width - 120;
    const markY = (height / 2) - (markSize / 2);

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(mark, markX, markY, markSize, markSize);
    ctx.restore();

    ctx.strokeStyle = 'rgba(0, 136, 255, 0.18)';
    ctx.lineWidth = 1;
    const markCenterX = markX + (markSize / 2);
    const markCenterY = markY + (markSize / 2);
    const markRingRadius = (markSize / 2) + 10;
    ctx.beginPath();
    ctx.arc(markCenterX, markCenterY, markRingRadius, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    // Optional asset
  }

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
