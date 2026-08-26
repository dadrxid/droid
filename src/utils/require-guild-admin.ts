import {ChatInputCommandInteraction, GuildMember, PermissionFlagsBits} from 'discord.js';

const DEFAULT_OWNER_ID = '397068987000815616';

export function getBotOwnerId(): string {
  const configured = process.env.BOT_OWNER_ID?.trim();
  return configured ? configured : DEFAULT_OWNER_ID;
}

export function isBotOwner(userId: string): boolean {
  return userId === getBotOwnerId();
}

export function memberIsGuildAdministrator(member: GuildMember): boolean {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/** Slash commands that change bot settings must pass this before running. */
export async function requireGuildAdministrator(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({content: '🚫 use this command in a server', ephemeral: true});
    return false;
  }

  const member = interaction.member as GuildMember;

  if (memberIsGuildAdministrator(member) || isBotOwner(interaction.user.id)) {
    return true;
  }

  await interaction.reply({
    content: '🚫 only server **Administrators** can change bot settings (welcome, auto role, FAQ, config).',
    ephemeral: true,
  });
  return false;
}

/** Use on slash command builders for server setup commands. */
export const GUILD_ADMIN_COMMAND_PERMISSIONS = PermissionFlagsBits.Administrator.toString();
