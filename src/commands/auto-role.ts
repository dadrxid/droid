import {SlashCommandBuilder} from '@discordjs/builders';
import {ChatInputCommandInteraction, PermissionFlagsBits, Role} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {
  describeAutoRoleStatus,
  roleBelongsToGuild,
  setAutoRoleForGuild,
} from '../utils/assign-auto-role.js';
import {requireGuildAdministrator} from '../utils/require-guild-admin.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('configure the auto role for this server only (Administrator only)')
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('set the role new members get on this server')
      .addRoleOption(option => option
        .setName('role')
        .setDescription('role to assign on join (must be a role from this server)')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable auto role on this server only'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show auto role for this server'));

  async execute(interaction: ChatInputCommandInteraction) {
    if (!await requireGuildAdministrator(interaction)) {
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const guildId = guild.id;

    switch (subcommand) {
      case 'set': {
        const role = interaction.options.getRole('role') as Role;
        const {members: {me}} = guild;

        if (!roleBelongsToGuild(role, guildId)) {
          await interaction.reply({
            content: '🚫 that role is not from this server — pick a role from **this** guild',
            ephemeral: true,
          });
          return;
        }

        if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.reply({content: '🚫 I need the **Manage Roles** permission to assign auto roles', ephemeral: true});
          return;
        }

        if (role.managed) {
          await interaction.reply({content: '🚫 that role is managed by an integration and cannot be assigned', ephemeral: true});
          return;
        }

        if (role.id === guild.roles.everyone.id) {
          await interaction.reply({content: '🚫 you cannot use the everyone role', ephemeral: true});
          return;
        }

        if (me.roles.highest.position <= role.position) {
          await interaction.reply({content: '🚫 my highest role must be above the auto role — move my role higher in Server Settings', ephemeral: true});
          return;
        }

        await setAutoRoleForGuild(guildId, role.id);

        await interaction.reply({
          content: `✅ **${guild.name}**: auto role set to **${role.name}** (<@&${role.id}>)\nNew members on **this server only** will receive it on join. Other servers are unchanged.`,
          ephemeral: true,
        });
        break;
      }

      case 'disable': {
        await setAutoRoleForGuild(guildId, null);

        await interaction.reply({
          content: `✅ **${guild.name}**: auto role disabled on this server only. Other servers are unchanged.`,
          ephemeral: true,
        });
        break;
      }

      case 'status': {
        await interaction.reply({
          content: await describeAutoRoleStatus(guild),
          ephemeral: true,
        });
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
