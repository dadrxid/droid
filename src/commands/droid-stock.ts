import {SlashCommandBuilder} from '@discordjs/builders';
import {EmbedBuilder, type ChatInputCommandInteraction, type GuildMember} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {staffCanManage} from '../lib/droid-tickets/service.js';
import {fetchDroidStock, type BotStockRow} from '../lib/droid-tickets/site.js';
import {getSettings, type GuildTicketSettings} from '../lib/droid-tickets/store.js';

/** Same roles as the Droid Rollers staff desk login. */
const DROID_ROLLERS_STAFF_ROLE_ID = '1517228034220888335';
const DROID_ROLLERS_OWNER_ROLE_ID = '1517227838133112923';

function canSeeStock(member: GuildMember, settings: GuildTicketSettings): boolean {
  if (staffCanManage(member, settings)) {
    return true;
  }

  return member.roles.cache.has(DROID_ROLLERS_STAFF_ROLE_ID)
    || member.roles.cache.has(DROID_ROLLERS_OWNER_ROLE_ID);
}

function lineFor(row: BotStockRow): string {
  return `${row.name} · ${String(row.qty)} ${row.unit}`;
}

function fieldsFor(title: string, rows: BotStockRow[]): Array<{name: string; value: string}> {
  if (rows.length === 0) {
    return [];
  }

  const fields: Array<{name: string; value: string}> = [];
  let chunk: string[] = [];
  let size = 0;
  let part = 1;

  const flush = () => {
    if (chunk.length === 0) {
      return;
    }

    fields.push({
      name: part === 1 ? title : `${title} · ${String(part)}`,
      value: chunk.join('\n').slice(0, 1024),
    });
    chunk = [];
    size = 0;
    part += 1;
  };

  for (const row of rows) {
    const line = lineFor(row);
    if (chunk.length > 0 && size + line.length + 1 > 1000) {
      flush();
    }

    chunk.push(line);
    size += line.length + 1;
  }

  flush();
  return fields;
}

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('droid-stock')
    .setDescription('Show the Droid Rollers parts drawer (staff only)')
    .setDMPermission(false)
    .addStringOption(option => option
      .setName('find')
      .setDescription('Optional: part name')
      .setRequired(false)
      .setMaxLength(40));

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({content: 'Use this in the Droid Rollers server.', ephemeral: true});
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const settings = await getSettings(interaction.guild.id);
    if (!canSeeStock(member, settings)) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    await interaction.deferReply({ephemeral: true});

    const stock = await fetchDroidStock();
    if (!stock) {
      await interaction.editReply({
        content: 'Could not load stock from the site. Desk is still at https://droidfix.uk/staff/droid-rollers',
      });
      return;
    }

    const needle = interaction.options.getString('find')?.trim().toLowerCase() ?? '';
    const items = needle
      ? stock.items.filter(row => row.name.toLowerCase().includes(needle) || row.groupLabel.toLowerCase().includes(needle))
      : stock.items;

    if (items.length === 0) {
      await interaction.editReply({content: needle ? `Nothing matches "${needle}".` : 'Drawer is empty.'});
      return;
    }

    const unix = stock.updatedAt ? Math.floor(Date.parse(stock.updatedAt) / 1000) : 0;
    const fields = [
      ...fieldsFor('On the bench', items.filter(row => row.status === 'bench')),
      ...fieldsFor('On the way', items.filter(row => row.status === 'inbound')),
      ...fieldsFor('Order in', items.filter(row => row.status === 'order')),
    ].slice(0, 25);
    const embed = new EmbedBuilder()
      .setColor(0x0088ff)
      .setTitle('Droid Rollers stock')
      .setDescription(
        [
          needle ? `Matches for "${needle}".` : 'Staff only. Customers can still pick anything on the sheet.',
          unix > 0 ? `Updated <t:${String(unix)}:R>` : '',
          'Desk: https://droidfix.uk/staff/droid-rollers',
        ].filter(Boolean).join('\n'),
      );

    if (fields.length > 0) {
      embed.addFields(fields);
    }

    await interaction.editReply({embeds: [embed]});
  }
}
