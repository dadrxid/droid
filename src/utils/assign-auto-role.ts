import {Guild, GuildMember, Role} from 'discord.js';
import {prisma} from './db.js';
import {getGuildSettings} from './get-guild-settings.js';

/** Auto role is stored per guild in Setting.autoRoleId. Each server configures its own role. */
export async function getAutoRoleId(guildId: string): Promise<string | null> {
  const setting = await prisma.setting.findUnique({where: {guildId}});
  return setting?.autoRoleId ?? null;
}

export async function setAutoRoleForGuild(guildId: string, roleId: string | null): Promise<void> {
  await getGuildSettings(guildId);

  await prisma.setting.update({
    where: {guildId},
    data: {autoRoleId: roleId},
  });
}

export function roleBelongsToGuild(role: Role, guildId: string): boolean {
  return role.guild.id === guildId;
}

export async function assignAutoRoleForMember(member: GuildMember): Promise<boolean> {
  const {guild} = member;
  const autoRoleId = await getAutoRoleId(guild.id);

  if (!autoRoleId) {
    return false;
  }

  const role = guild.roles.cache.get(autoRoleId);

  if (!role) {
    console.warn(
      `[autorole] Guild ${guild.name} (${guild.id}) has stale autoRoleId ${autoRoleId} — run /autorole disable or set again`,
    );
    return false;
  }

  if (role.managed) {
    console.warn(`[autorole] Skipping managed role ${role.name} on ${guild.name}`);
    return false;
  }

  if (member.roles.cache.has(role.id)) {
    return true;
  }

  await member.roles.add(role);
  return true;
}

export async function describeAutoRoleStatus(guild: Guild): Promise<string> {
  const autoRoleId = await getAutoRoleId(guild.id);

  if (!autoRoleId) {
    return `**${guild.name}**: auto role is **disabled** (this server only)`;
  }

  const role = guild.roles.cache.get(autoRoleId);

  if (!role) {
    return `**${guild.name}**: auto role ID \`${autoRoleId}\` no longer exists on this server — use \`/autorole disable\``;
  }

  return `**${guild.name}**: new members get **${role.name}** (<@&${role.id}>) · this setting applies to this server only`;
}
