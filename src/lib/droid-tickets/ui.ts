import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import {branded} from '../droid-brand.js';
import type {TicketField, TicketKind, TicketRecord} from './store.js';
import type {TicketPanel, TicketPanelType} from './site.js';

export const BRAND_BLUE = 0x0088ff;
const CLOSED_AMBER = 0xffb020;

const STYLE: Record<TicketPanelType['buttonStyle'], ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

export function kindLabel(kind: TicketKind, panel?: TicketPanel): string {
  const type = panel?.types.find(row => row.id === kind);
  if (type?.label) {
    return type.label;
  }

  if (kind === 'repair') {
    return 'Repair';
  }

  if (kind === 'custom') {
    return 'Custom build';
  }

  return kind.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Ticket';
}

export const KIND_LABELS: Record<string, string> = {
  custom: 'Custom build',
  repair: 'Repair',
};

function parseColor(raw: string): number {
  const hex = raw.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return BRAND_BLUE;
  }

  return Number.parseInt(hex, 16);
}

function buttonLabel(type: TicketPanelType): string {
  if (type.accepting) {
    return type.buttonLabel.slice(0, 80);
  }

  const suffix = ' · closed';
  return `${type.buttonLabel.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
}

export function panelEmbed(emoji: string, panel: TicketPanel): EmbedBuilder {
  const closed = panel.types.some(row => row.enabled && !row.accepting);
  const look = panel.panel;
  const lines = look.description
    ? [look.description]
    : ['Pick a button and fill in the short form. Your private ticket opens straight after.'];
  const embed = new EmbedBuilder()
    .setColor(closed ? CLOSED_AMBER : parseColor(look.color))
    .setTitle(branded(emoji, look.title || 'DroidFix tickets'))
    .setDescription(lines.join('\n').slice(0, 4096))
    .setFooter({text: (look.footer || 'droidfix.uk · only you and the DroidFix team can see your ticket').slice(0, 2048)});

  if (look.thumbnailUrl) {
    embed.setThumbnail(look.thumbnailUrl);
  }

  if (look.imageUrl) {
    embed.setImage(look.imageUrl);
  }

  return embed;
}

export function panelRows(emoji: string, panel: TicketPanel): any[] {
  const types = panel.types.filter(row => row.enabled).slice(0, 10);
  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let index = 0; index < types.length; index += 5) {
    const chunk = types.slice(index, index + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const type of chunk) {
      const button = new ButtonBuilder()
        .setCustomId(`dt:new:${type.id}`)
        .setLabel(buttonLabel(type))
        .setStyle(type.accepting ? STYLE[type.buttonStyle] : ButtonStyle.Secondary);
      const mark = type.buttonEmoji || (type.id === 'custom' ? emoji : '');
      if (mark) {
        button.setEmoji(mark);
      }

      row.addComponents(button);
    }

    rows.push(row);
  }

  return rows;
}

/** One tidy embed: greeting, the ground rules for that ticket type, and the form answers. */
export function welcomeEmbed(options: {
  kind: TicketKind;
  id: string;
  openerId: string;
  staffRoleId: string;
  fields: TicketField[];
  emoji: string;
  logo?: string;
  title?: string;
  body?: string;
  footer?: string;
}): EmbedBuilder {
  const {kind, id, openerId, staffRoleId, fields, emoji, logo} = options;
  const staff = staffRoleId ? `<@&${staffRoleId}>` : 'Andrew';
  const fallback = kind === 'custom'
    ? [
      `Thanks <@${openerId}>. Pick your parts on the build sheet below and the price updates as you go.`,
      '',
      'Built and shipped in house · 4 to 6 weeks, sometimes sooner · UK postage included.',
      `${staff} will send the checkout link and can sort anything else in here.`,
    ]
    : kind === 'repair'
      ? [
        `Thanks <@${openerId}>. Post a photo or a short clip of the fault when you can.`,
        '',
        'UK mail-in only.',
        'Already own a custom pad, a Scuf or another modder\'s build? An 8K board swap is welcome here.',
        `${staff} will send you the postage details and price it up in here.`,
      ]
      : [
        `Thanks <@${openerId}>.`,
        '',
        `${staff} will pick this up in here.`,
      ];

  const body = options.body?.trim()
    ? [`Thanks <@${openerId}>.`, '', options.body.trim(), '', `${staff} will pick this up in here.`]
    : fallback;

  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(branded(emoji, `${options.title ? options.title : kindLabel(kind)} · ${id}`))
    .setDescription(body.join('\n').slice(0, 4096))
    .setFooter({text: (options.footer ? options.footer : 'droidfix.uk · press Close when you are finished').slice(0, 2048)});

  for (const field of fields) {
    embed.addFields({
      name: field.label.slice(0, 256),
      value: field.value.slice(0, 1024),
      inline: field.value.length <= 40,
    });
  }

  return logo ? embed.setThumbnail(logo) : embed;
}

export function openControlsRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:close')
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:claim')
      .setLabel('Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
  );
}

export function closeConfirmRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:close-yes')
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('dt:close-no')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function deleteConfirmRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:delete-yes')
      .setLabel('Delete for good')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('dt:delete-no')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function staffControlsRow(): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('dt:transcript')
      .setLabel('Transcript')
      .setEmoji('📄')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:open')
      .setLabel('Open')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dt:delete')
      .setLabel('Delete')
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Danger),
  );
}

export function closedEmbed(closedByTag: string, reason: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(CLOSED_AMBER)
    .setDescription(`Ticket closed by **${closedByTag}**`);

  if (reason) {
    embed.addFields({name: 'Reason', value: reason.slice(0, 1024)});
  }

  return embed;
}

export function staffControlsEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(CLOSED_AMBER)
    .setDescription('```Support team ticket controls```');
}

export function logEmbed(ticket: TicketRecord, extra: {users: string[]}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Transcript · ${ticket.id}`)
    .addFields(
      {name: 'Ticket owner', value: ticket.openerId ? `<@${ticket.openerId}>` : 'unknown', inline: true},
      {name: 'Ticket name', value: ticket.channelName || ticket.id, inline: true},
      {name: 'Type', value: kindLabel(ticket.kind), inline: true},
      {name: 'Messages', value: String(ticket.messageCount), inline: true},
      {
        name: 'Closed by',
        value: ticket.closedByTag || 'unknown',
        inline: true,
      },
    );

  if (ticket.claimedByTag) {
    embed.addFields({name: 'Claimed by', value: ticket.claimedByTag, inline: true});
  }

  if (ticket.closeReason) {
    embed.addFields({name: 'Reason', value: ticket.closeReason.slice(0, 1024)});
  }

  if (extra.users.length > 0) {
    embed.addFields({name: 'In transcript', value: extra.users.slice(0, 15).join('\n').slice(0, 1024)});
  }

  return embed;
}

export function directLinkRow(url: string): any {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Direct Link')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL(url),
  );
}
