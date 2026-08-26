import {SlashCommandBuilder} from '@discordjs/builders';
import {
  ActionRowBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  type Message,
} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {getBotOwnerId, requireGuildAdministrator} from '../utils/require-guild-admin.js';
import {type PhotoKind, getSpec, type DroidSpec} from '../lib/droid-spec/state.js';
import {extraRows, formRows, photoKindRow, specEmbed} from '../lib/droid-spec/ui.js';

const PHOTO_WAIT_MS = 60_000;
const MAX_PHOTOS = 5;
const pendingKind = new Map<string, PhotoKind>();

function waitKey(channelId: string, userId: string): string {
  return `${channelId}:${userId}`;
}

function isImageMessage(message: Message): boolean {
  return [...message.attachments.values()].some(file => {
    const type = file.contentType ?? '';
    return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name ?? '');
  });
}

async function refresh(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  spec: DroidSpec,
): Promise<void> {
  const embed = specEmbed(spec);
  const channel = interaction.channel;
  const canEdit = Boolean(channel && 'messages' in channel);

  if (interaction.isModalSubmit()) {
    if (spec.formMessageId && canEdit) {
      await channel!.messages.edit(spec.formMessageId, {embeds: [embed], components: formRows()});
    }

    if (spec.extraMessageId && canEdit) {
      await channel!.messages.edit(spec.extraMessageId, {embeds: [embed], components: extraRows()});
    }

    return;
  }

  const onForm = interaction.message.id === spec.formMessageId;
  if (onForm) {
    await interaction.update({embeds: [embed], components: formRows()});
    if (spec.extraMessageId && canEdit) {
      await channel!.messages.edit(spec.extraMessageId, {embeds: [embed], components: extraRows()});
    }
  } else {
    await interaction.update({embeds: [embed], components: extraRows()});
    if (spec.formMessageId && canEdit) {
      await channel!.messages.edit(spec.formMessageId, {embeds: [embed], components: formRows()});
    }
  }
}

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('rollers-spec')
    .setDescription('Post the custom 8K spec form in this ticket (Admin only)');

  public readonly handledButtonIds = [
    'droidspec:photo',
    'droidspec:shellnote',
    'droidspec:bbnote',
    'droidspec:submit',
  ];

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireGuildAdministrator(interaction)) {
      return;
    }

    if (!interaction.channel?.isTextBased()) {
      await interaction.reply({content: 'Use this in a ticket text channel.', ephemeral: true});
      return;
    }

    const spec = getSpec(interaction.channel.id);
    const embed = specEmbed(spec);
    await interaction.reply({embeds: [embed], components: formRows()});
    const form = await interaction.fetchReply();
    const extra = await interaction.channel.send({
      embeds: [embed],
      components: extraRows(),
    });
    spec.formMessageId = form.id;
    spec.extraMessageId = extra.id;
  }

  async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.channelId) {
      return;
    }

    const spec = getSpec(interaction.channelId);
    const value = interaction.values[0] ?? '';
    const id = interaction.customId;

    if (id === 'droidspec:photokind') {
      await this.startPhotoWait(interaction, value as PhotoKind);
      return;
    }

    if (id === 'droidspec:board') {
      spec.board = value;
    } else if (id === 'droidspec:sticks') {
      spec.sticks = value;
    } else if (id === 'droidspec:caps') {
      spec.caps = value;
    } else if (id === 'droidspec:shell') {
      spec.shell = value;
    } else if (id === 'droidspec:faces') {
      spec.faces = value;
    } else if (id === 'droidspec:backs') {
      spec.backs = value;
    } else if (id === 'droidspec:click') {
      spec.click = value;
    } else if (id === 'droidspec:bbcount') {
      spec.bbCount = value;
    } else if (id === 'droidspec:bbplace') {
      spec.bbPlace = value;
    }

    await refresh(interaction, spec);
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.channelId || !interaction.channel?.isTextBased()) {
      await interaction.reply({content: 'Use this in a ticket channel.', ephemeral: true});
      return;
    }

    const spec = getSpec(interaction.channelId);

    if (interaction.customId === 'droidspec:photo') {
      if (spec.photos.length >= MAX_PHOTOS) {
        await interaction.reply({content: `Max ${String(MAX_PHOTOS)} photos.`, ephemeral: true});
        return;
      }

      await interaction.reply({
        content: 'What is this photo of?',
        components: [photoKindRow()],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === 'droidspec:shellnote') {
      const modal = new ModalBuilder()
        .setCustomId('droidspec:modalshell')
        .setTitle('Shell colour')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('note')
              .setLabel('Colour or description')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setMaxLength(80)
              .setPlaceholder('e.g. mint'),
          ),
        );
      await interaction.showModal(modal as never);
      return;
    }

    if (interaction.customId === 'droidspec:bbnote') {
      const modal = new ModalBuilder()
        .setCustomId('droidspec:modalbb')
        .setTitle('Battle Beaver placement')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('note')
              .setLabel('Left / right / extra notes')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
              .setMaxLength(200)
              .setPlaceholder('e.g. 2 high left, 2 standard right'),
          ),
        );
      await interaction.showModal(modal as never);
      return;
    }

    if (interaction.customId === 'droidspec:submit') {
      const ownerId = getBotOwnerId();
      const photoEmbeds = spec.photos.slice(0, 8).map(photo =>
        new EmbedBuilder().setTitle(`Photo · ${photo.kind}`).setImage(photo.url),
      );
      await interaction.reply({
        content: `<@${ownerId}> spec is in.\nAndrew will quote, then send a checkout link when the listing is ready.`,
        embeds: [specEmbed(spec), ...photoEmbeds],
        allowedMentions: {users: [ownerId]},
      });
    }
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.channelId) {
      return;
    }

    const spec = getSpec(interaction.channelId);
    const note = interaction.fields.getTextInputValue('note').trim();
    if (interaction.customId === 'droidspec:modalshell') {
      spec.shellNote = note;
    } else if (interaction.customId === 'droidspec:modalbb') {
      spec.bbNote = note;
    }

    await interaction.reply({content: 'Saved.', ephemeral: true});
    await refresh(interaction, spec);
  }

  private async startPhotoWait(interaction: StringSelectMenuInteraction, kind: PhotoKind): Promise<void> {
    const channel = interaction.channel;
    if (!channel || !interaction.channelId || !('createMessageCollector' in channel)) {
      await interaction.update({content: 'Cannot collect photos here.', components: []});
      return;
    }

    pendingKind.set(waitKey(interaction.channelId, interaction.user.id), kind);
    await interaction.update({
      content: `Paste or drag a **${kind}** photo in this ticket now (60 seconds). Not a link.`,
      components: [],
    });

    const collector = channel.createMessageCollector({
      filter: (message: Message) =>
        message.author.id === interaction.user.id && isImageMessage(message),
      max: 1,
      time: PHOTO_WAIT_MS,
    });

    collector.on('collect', message => {
      const spec = getSpec(interaction.channelId);
      const file = [...message.attachments.values()].find(file => {
        const type = file.contentType ?? '';
        return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name ?? '');
      });
      if (!file || spec.photos.length >= MAX_PHOTOS) {
        return;
      }

      spec.photos.push({kind, url: file.url, name: file.name ?? 'photo'});
      pendingKind.delete(waitKey(interaction.channelId, interaction.user.id));
      void message.react('✅').catch(() => undefined);
      if (spec.formMessageId && 'messages' in channel) {
        void channel.messages.edit(spec.formMessageId, {
          embeds: [specEmbed(spec)],
          components: formRows(),
        }).catch(() => undefined);
      }

      if (spec.extraMessageId && 'messages' in channel) {
        void channel.messages.edit(spec.extraMessageId, {
          embeds: [specEmbed(spec)],
          components: extraRows(),
        }).catch(() => undefined);
      }
    });

    collector.on('end', collected => {
      pendingKind.delete(waitKey(interaction.channelId, interaction.user.id));
      if (collected.size === 0) {
        void interaction.followUp({
          content: 'No photo received in 60 seconds. Use **Add photo** again.',
          ephemeral: true,
        }).catch(() => undefined);
      }
    });
  }
}
