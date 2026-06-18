import {GuildMember} from 'discord.js';
import {assignAutoRoleForMember} from '../utils/assign-auto-role.js';
import {sendConfiguredWelcomes} from '../utils/send-welcome.js';

export default async (member: GuildMember): Promise<void> => {
  try {
    await assignAutoRoleForMember(member);
  } catch (error) {
    console.error(`Failed to assign auto role on ${member.guild.name} (${member.guild.id}):`, error);
  }

  await sendConfiguredWelcomes(member);
};
