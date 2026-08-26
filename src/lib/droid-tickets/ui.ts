import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type {TicketField, TicketKind, TicketRecord} from './store.js';

export const BRAND_BLUE = 0x0088ff;
const CLOSED_AMBER = 0xffb020;

export const KIND_LABELS: Record<TicketKind, string> = {
  custom: 'Custom build',
  repair: 'Repair',
};

export function panelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle('DROIDFIX')
    .setDescription([
      'Pick a button below and fill the short form. Your private ticket opens once the form is sent.',
      '',
      '**Custom build** · a custom 8K PlayStation-style pad. Shells, paddles, caps, mouse click.',
      '**Repair** · stick drift, dead buttons, charging, mail-in from anywhere in the UK.',
      '',
      'Only you and the DroidFix team can see your ticket.',
    ].join('\n'))
    .setFooter({text: 'droidfix.uk · Middlesbrough'});
}

export function panelRows(): any[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('dt:new:custom')
        .setLabel('Custom build')
        .setEmoji('🎮')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('dt:new:repair')
        .setLabel('Repair')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function welcomeEmbed(kind: TicketKind, openerId: string, staffRoleId: string): EmbedBuilder {
  const lines = [
    `Thanks <@${openerId}>. This is your private ${KIND_LABELS[kind].toLowerCase()} ticket.`,
    '',
    staffRoleId
      ? `${`<@&${staffRoleId}>`} will be with you as soon as they can. Andrew is a one-man workshop with a day job, so it can be a few hours.`
      : 'Andrew will be with you as soon as he can. One-man workshop, so it can be a few hours.',
    'Leave everything you can here and it gets sorted faster. Photos help a lot.',
  ];

  if (kind === 'custom') {
    lines.push('', 'Use the build sheet below to pick your parts. The prices update live from the workshop list.');
  } else {
    lines.push('', 'Post a photo or a short clip of the fault if you can.');
  }

  lines.push('', 'Press **Close** when you are done.');

  return new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`${KIND_LABELS[kind]} ticket`)
    .setDescription(lines.join('\n'));
}

export function answersEmbed(id: string, fields: TicketField[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_BLUE)
    .setTitle(`Form answers · ${id}`);

  if (fields.length === 0) {
    return embed.setDescription('No answers given.');
  }

  for (const field of fields) {
    embed.addFields({name: field.label.slice(0, 256), value: field.value.slice(0, 1024)});
  }

  return embed;
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
      {name: 'Type', value: KIND_LABELS[ticket.kind], inline: true},
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
