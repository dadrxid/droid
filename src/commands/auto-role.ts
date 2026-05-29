import {SlashCommandBuilder} from '@discordjs/builders';
import {ChatInputCommandInteraction, PermissionFlagsBits, Role} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {prisma} from '../utils/db.js';

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('configure the auto role assigned to new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles.toString())
    .addSubcommand(subcommand => subcommand
      .setName('set')
      .setDescription('set the role to assign to new members')
      .addRoleOption(option => option
        .setName('role')
        .setDescription('the role to assign')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('disable')
      .setDescription('disable auto role'))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('show the current auto role setting'));

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild!.id;

    switch (subcommand) {
      case 'set': {
        const role = interaction.options.getRole('role') as Role;

        if (role.managed) {
          await interaction.reply({content: '🚫 that role is managed by an integration and cannot be assigned', ephemeral: true});
          return;
        }

        if (role.id === interaction.guild!.roles.everyone.id) {
          await interaction.reply({content: '🚫 you cannot use the everyone role', ephemeral: true});
          return;
        }

        await prisma.setting.update({
          where: {guildId},
          data: {autoRoleId: role.id},
        });

        await interaction.reply({content: `✅ auto role set to **${role.name}** — new members will receive it on join`, ephemeral: true});
        break;
      }

      case 'disable': {
        await prisma.setting.update({
          where: {guildId},
          data: {autoRoleId: null},
        });

        await interaction.reply({content: '✅ auto role disabled', ephemeral: true});
        break;
      }

      case 'status': {
        const setting = await prisma.setting.findUnique({where: {guildId}});
        const roleId = setting?.autoRoleId;

        if (!roleId) {
          await interaction.reply({content: 'auto role is currently **disabled**', ephemeral: true});
          return;
        }

        const role = interaction.guild!.roles.cache.get(roleId);

        if (!role) {
          await interaction.reply({content: 'auto role was set but the role no longer exists — use `/autorole disable` to clear it', ephemeral: true});
          return;
        }

        await interaction.reply({content: `auto role is set to **${role.name}**`, ephemeral: true});
        break;
      }

      default:
        throw new Error('unknown subcommand');
    }
  }
}
