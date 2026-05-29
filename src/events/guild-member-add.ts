import {GuildMember, TextChannel, AttachmentBuilder} from 'discord.js';
import {createCanvas, loadImage, GlobalFonts} from '@napi-rs/canvas';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async (member: GuildMember): Promise<void> => {
	const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
	if (!welcomeChannelId) return;

	const channel = member.guild.channels.cache.get(welcomeChannelId);
	if (!channel?.isTextBased()) return;

	try {
		const attachment = await generateWelcomeImage(member);
		await (channel as TextChannel).send({
			content: `Hey <@${member.id}> — you're in.`,
			files: [attachment],
		});
	} catch (error) {
		console.error('Failed to send welcome message:', error);
	}
};

async function generateWelcomeImage(member: GuildMember): Promise<AttachmentBuilder> {
	const width = 900;
	const height = 300;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Dark background
	ctx.fillStyle = '#060d12';
	ctx.fillRect(0, 0, width, height);

	// Grid overlay
	ctx.strokeStyle = 'rgba(0, 212, 255, 0.04)';
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

	// Radial glow top center
	const glow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, 300);
	glow.addColorStop(0, 'rgba(0, 180, 160, 0.07)');
	glow.addColorStop(1, 'transparent');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, width, height);

	// Border
	ctx.strokeStyle = 'rgba(0, 212, 255, 0.12)';
	ctx.lineWidth = 1;
	ctx.strokeRect(1, 1, width - 2, height - 2);

	// Left bracket
	ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
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

	// Right bracket
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

	// Avatar circle border (cyan)
	const avatarX = 100;
	const avatarY = height / 2;
	const avatarRadius = 55;

	ctx.strokeStyle = '#00d4ff';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
	ctx.stroke();

	// Teal inner ring
	ctx.strokeStyle = 'rgba(0, 180, 160, 0.4)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarRadius + 8, 0, Math.PI * 2);
	ctx.stroke();

	// Avatar image
	try {
		const avatarUrl = member.user.displayAvatarURL({extension: 'png', size: 128});
		const avatar = await loadImage(avatarUrl);
		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
		ctx.restore();
	} catch {
		// Fallback circle if avatar fails
		ctx.fillStyle = '#0a1520';
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
		ctx.fill();
	}

	// droidlab wordmark
	ctx.font = 'bold 38px sans-serif';
	ctx.fillStyle = '#ffffff';
	ctx.fillText('droid', 190, 110);
	const droidWidth = ctx.measureText('droid').width;
	ctx.fillStyle = '#00d4ff';
	ctx.fillText('lab', 190 + droidWidth, 110);

	// Status dot
	ctx.fillStyle = '#00b4a0';
	ctx.beginPath();
	ctx.arc(190 + droidWidth + ctx.measureText('lab').width + 10, 100, 5, 0, Math.PI * 2);
	ctx.fill();

	// Divider
	ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
	ctx.lineWidth = 0.5;
	ctx.beginPath();
	ctx.moveTo(190, 125);
	ctx.lineTo(580, 125);
	ctx.stroke();

	// Welcome text
	ctx.font = 'bold 22px sans-serif';
	ctx.fillStyle = '#c8e8f0';
	ctx.fillText('You\'ve connected.', 190, 165);

	// Username
	ctx.font = '14px monospace';
	ctx.fillStyle = '#5a8a9a';
	ctx.fillText(`> ${member.user.username}`, 190, 195);

	// Member count
	const memberCount = member.guild.memberCount;
	ctx.font = '12px monospace';
	ctx.fillStyle = '#2a4a5a';
	ctx.fillText(`member #${memberCount}`, 190, 220);

	// Footer
	ctx.font = '11px monospace';
	ctx.fillStyle = '#1e3a4a';
	ctx.fillText('// droidlab.org  ·  zimaos', 190, 265);

	const buffer = canvas.toBuffer('image/png');
	return new AttachmentBuilder(buffer, {name: 'welcome.png'});
}
