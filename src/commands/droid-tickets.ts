import {SlashCommandBuilder} from '@discordjs/builders';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import {injectable} from 'inversify';
import Command from './index.js';
import {requireGuildAdministrator} from '../utils/require-guild-admin.js';
import {postSpecStarter} from '../lib/droid-spec/wizard.js';
import {formPages, readTicketFormPage, ticketModal, ticketType} from '../lib/droid-tickets/forms.js';
import {
  closeTicket,
  createTicket,
  deleteTicket,
  reopenTicket,
  saveTranscript,
  staffCanManage,
  userTag,
} from '../lib/droid-tickets/service.js';
import {
  siteSyncEnabled,
  fetchTicketPanel,
  ticketKindClosedNote,
  ticketKindOpen,
} from '../lib/droid-tickets/site.js';
import {
  editPanelMessage,
  findExistingPanel,
  livePanelStamp,
  panelPayload,
  rememberPanel,
} from '../lib/droid-tickets/panel-sync.js';
import {
  getSettings,
  openTicketFor,
  patchTicket,
  saveSettings,
  ticketForChannel,
  type TicketKind,
  type TicketRecord,
} from '../lib/droid-tickets/store.js';
import {
  closeConfirmRow,
  deleteConfirmRow,
  kindLabel,
} from '../lib/droid-tickets/ui.js';

type PendingForm = {kind: TicketKind; page: number; fields: TicketRecord['fields']; expiresAt: number};
const pendingForms = new Map<string, PendingForm>();
const FORM_TTL_MS = 15 * 60 * 1000;

function prunePendingForms(): void {
  const now = Date.now();
  for (const [key, row] of pendingForms) {
    if (row.expiresAt <= now) {
      pendingForms.delete(key);
    }
  }
}

/** One ticket per member per kind, and a short cooldown so buttons cannot be spammed. */
const OPEN_COOLDOWN_MS = 20_000;
const lastOpen = new Map<string, number>();

function ticketKindFromCustomId(customId: string): TicketKind | undefined {
  const match = /^(?:dt:new:|dt:form-next:|dt:form:)([a-z][a-z0-9-]{0,20})(?::|$)/.exec(customId);
  return match?.[1];
}

function formPageFromCustomId(customId: string): number {
  const match = /^(?:dt:form|dt:form-next):[a-z][a-z0-9-]{0,20}:(\d+)$/.exec(customId);
  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1], 10) || 0;
}

@injectable()
export default class implements Command {
  public readonly slashCommand = new SlashCommandBuilder()
    .setName('droid-tickets')
    .setDescription('DroidFix ticket system')
    .addSubcommand(subcommand => subcommand
      .setName('setup')
      .setDescription('Point tickets at a category, staff role and log channel (Admin only)')
      .addChannelOption(option => option
        .setName('category')
        .setDescription('Category new tickets are created in')
        .setRequired(true))
      .addRoleOption(option => option
        .setName('staff-role')
        .setDescription('Role that can see tickets and use the staff controls')
        .setRequired(true))
      .addChannelOption(option => option
        .setName('log-channel')
        .setDescription('Text channel that transcripts are posted to')
        .setRequired(true))
      .addChannelOption(option => option
        .setName('archive-category')
        .setDescription('Optional: category closed tickets are moved to')
        .setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('panel')
      .setDescription('Post or update the Create ticket panel (Admin only)')
      .addChannelOption(option => option
        .setName('channel')
        .setDescription('Where the ticket buttons go (default: this channel)')
        .setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('status')
      .setDescription('Show the current ticket settings (Admin only)'))
    .addSubcommand(subcommand => subcommand
      .setName('close')
      .setDescription('Close this ticket with a reason')
      .addStringOption(option => option
        .setName('reason')
        .setDescription('Why the ticket is being closed')
        .setMaxLength(400)
        .setRequired(false)))
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription('Add someone to this ticket')
      .addUserOption(option => option
        .setName('user')
        .setDescription('Who to add')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('remove')
      .setDescription('Remove someone from this ticket')
      .addUserOption(option => option
        .setName('user')
        .setDescription('Who to remove')
        .setRequired(true)));

  public readonly handledButtonIds = [
    'dt:new:custom',
    'dt:new:repair',
    'dt:close',
    'dt:close-yes',
    'dt:close-no',
    'dt:claim',
    'dt:transcript',
    'dt:open',
    'dt:delete',
    'dt:delete-yes',
    'dt:delete-no',
  ];

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup' || subcommand === 'panel' || subcommand === 'status') {
      if (!await requireGuildAdministrator(interaction)) {
        return;
      }
    }

    if (subcommand === 'setup') {
      await this.runSetup(interaction);
      return;
    }

    if (subcommand === 'panel') {
      await this.runPanel(interaction);
      return;
    }

    if (subcommand === 'status') {
      await this.runStatus(interaction);
      return;
    }

    if (subcommand === 'close') {
      await this.runClose(interaction);
      return;
    }

    if (subcommand === 'add' || subcommand === 'remove') {
      await this.runAccess(interaction, subcommand);
    }
  }

  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const kind = ticketKindFromCustomId(interaction.customId);

    if (kind && interaction.customId.startsWith('dt:new:')) {
      await this.openForm(interaction, kind);
      return;
    }

    if (kind && interaction.customId.startsWith('dt:form-next:')) {
      await interaction.showModal(ticketModal(kind, formPageFromCustomId(interaction.customId)) as never);
      return;
    }

    switch (interaction.customId) {
      case 'dt:close': {
        await this.askClose(interaction);
        return;
      }

      case 'dt:close-yes': {
        await this.confirmClose(interaction);
        return;
      }

      case 'dt:close-no':
      case 'dt:delete-no': {
        await interaction.update({content: 'Cancelled. Nothing changed.', embeds: [], components: []});
        return;
      }

      case 'dt:claim': {
        await this.claim(interaction);
        return;
      }

      case 'dt:transcript': {
        await this.sendTranscript(interaction);
        return;
      }

      case 'dt:open': {
        await this.reopen(interaction);
        return;
      }

      case 'dt:delete': {
        await this.askDelete(interaction);
        return;
      }

      case 'dt:delete-yes': {
        await this.confirmDelete(interaction);
        break;
      }

      default: {
        break;
      }
    }
  }

  async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const kind = ticketKindFromCustomId(interaction.customId);
    if (!kind || !interaction.guild) {
      return;
    }

    await interaction.deferReply({ephemeral: true});

    const panel = await fetchTicketPanel();
    if (!ticketKindOpen(kind, panel)) {
      await interaction.editReply(ticketKindClosedNote(kind, panel));
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.editReply('Could not read your server profile. Try again.');
      return;
    }

    const existing = await openTicketFor(interaction.guild.id, member.id, kind);
    if (existing && interaction.guild.channels.cache.has(existing.channelId)) {
      await interaction.editReply(
        `You already have an open ${kindLabel(kind, panel)} ticket: <#${existing.channelId}>. Use that one.`,
      );
      return;
    }

    if (existing) {
      await patchTicket(existing.channelId, {status: 'deleted'});
    }

    const page = formPageFromCustomId(interaction.customId);
    const pageFields = readTicketFormPage(kind, page, id => {
      try {
        return interaction.fields.getTextInputValue(id);
      } catch {
        return '';
      }
    });
    prunePendingForms();
    const pendingKey = `${interaction.guild.id}:${member.id}:${kind}`;
    const previous = page === 0 ? [] : (pendingForms.get(pendingKey)?.fields ?? []);
    const fields = [...previous, ...pageFields];
    const type = ticketType(kind);
    const pages = type ? formPages(type) : [];
    if (page + 1 < pages.length) {
      pendingForms.set(pendingKey, {kind, page: page + 1, fields, expiresAt: Date.now() + FORM_TTL_MS});
      await interaction.editReply({
        content: 'More questions on the next page.',
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`dt:form-next:${kind}:${String(page + 1)}`)
              .setLabel('Continue')
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      } as never);
      return;
    }

    pendingForms.delete(pendingKey);

    const result = await createTicket({guild: interaction.guild, opener: member, kind, fields});
    if (!result.ok) {
      await interaction.editReply(result.reason);
      return;
    }

    if (type?.orderBuilderEnabled) {
      await postSpecStarter(result.channel).catch((error: unknown) => {
        console.warn('Could not post the build sheet:', error);
      });
    }

    await interaction.editReply(`Ticket open: <#${result.channel.id}>. Everything else happens in there.`);
  }

  private async runSetup(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      return;
    }

    const category = interaction.options.getChannel('category', true);
    const staffRole = interaction.options.getRole('staff-role', true);
    const logChannel = interaction.options.getChannel('log-channel', true);
    const archive = interaction.options.getChannel('archive-category', false);

    if (category.type !== ChannelType.GuildCategory) {
      await interaction.reply({content: '`category` has to be a category, not a channel.', ephemeral: true});
      return;
    }

    if (archive && archive.type !== ChannelType.GuildCategory) {
      await interaction.reply({content: '`archive-category` has to be a category.', ephemeral: true});
      return;
    }

    if (logChannel.type !== ChannelType.GuildText) {
      await interaction.reply({content: '`log-channel` has to be a normal text channel.', ephemeral: true});
      return;
    }

    await saveSettings(interaction.guild.id, {
      categoryId: category.id,
      staffRoleId: staffRole.id,
      logChannelId: logChannel.id,
      archiveCategoryId: archive?.id ?? '',
    });

    const {me} = interaction.guild.members;
    const missing: string[] = [];
    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      missing.push('Manage Channels');
    }

    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      missing.push('Manage Roles (for the private overwrites)');
    }

    await interaction.reply({
      ephemeral: true,
      content: [
        '**Tickets set up.**',
        `Category: <#${category.id}>`,
        `Staff role: <@&${staffRole.id}>`,
        `Log channel: <#${logChannel.id}>`,
        archive ? `Archive category: <#${archive.id}>` : 'Archive category: not set (closed tickets stay put)',
        siteSyncEnabled()
          ? 'Website sync: on (transcripts land on droidfix.uk/staff/tickets)'
          : 'Website sync: **off** — set `DROIDFIX_BOT_TOKEN` on the bot and on Railway',
        missing.length > 0 ? `⚠️ I am missing: ${missing.join(', ')}` : '',
        'Now run `/droid-tickets panel` in the channel members should use.',
      ].filter(Boolean).join('\n'),
    });
  }

  private async runPanel(interaction: ChatInputCommandInteraction): Promise<void> {
    const chosen = interaction.options.getChannel('channel', false);

    if (chosen && chosen.type !== ChannelType.GuildText) {
      await interaction.reply({content: '`channel` has to be a normal text channel.', ephemeral: true});
      return;
    }

    const target = chosen
      ? await interaction.guild?.channels.fetch(chosen.id).catch(() => null)
      : interaction.channel;

    if (!target?.isTextBased() || !('send' in target)) {
      await interaction.reply({content: 'Pick a normal text channel, or run this in one.', ephemeral: true});
      return;
    }

    const settings = await getSettings(interaction.guildId ?? '');
    if (!settings.categoryId) {
      await interaction.reply({
        content: 'Run `/droid-tickets setup` first, otherwise the buttons have nowhere to put tickets.',
        ephemeral: true,
      });
      return;
    }

    const panel = await fetchTicketPanel();
    const payload = panelPayload(interaction.guild, panel);

    const existing = target.type === ChannelType.GuildText
      ? await findExistingPanel(target)
      : null;

    try {
      if (existing) {
        await editPanelMessage(existing, panel);
        await rememberPanel(interaction.guildId ?? '', existing.channelId, existing.id);
        await interaction.reply({
          content: `Panel updated in <#${target.id}>. Staff desk edits will keep this message in line. No need to delete it.`,
          ephemeral: true,
        });
        return;
      }

      const posted = await target.send(payload);
      await rememberPanel(interaction.guildId ?? '', posted.channelId, posted.id, livePanelStamp(panel));
    } catch {
      await interaction.reply({
        content: `I cannot post in <#${target.id}>. Give me View Channel, Send Messages and Embed Links there.`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `Panel posted in <#${target.id}>. Staff desk edits will update this message. Do not delete it.`,
      ephemeral: true,
    });
  }

  private async runStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    const settings = await getSettings(interaction.guildId ?? '');
    await interaction.reply({
      ephemeral: true,
      content: [
        '**Ticket settings**',
        settings.categoryId ? `Category: <#${settings.categoryId}>` : 'Category: not set',
        settings.staffRoleId ? `Staff role: <@&${settings.staffRoleId}>` : 'Staff role: not set',
        settings.logChannelId ? `Log channel: <#${settings.logChannelId}>` : 'Log channel: not set',
        settings.archiveCategoryId ? `Archive: <#${settings.archiveCategoryId}>` : 'Archive: not set',
        settings.panelChannelId ? `Panel: <#${settings.panelChannelId}>` : 'Panel: not tracked yet. Run /droid-tickets panel once, or press a ticket button.',
        `Numbers so far: ${Object.entries(settings.counters).map(([key, value]) => `${key} ${String(value)}`).join(', ') || 'none'}`,
        `Website sync: ${siteSyncEnabled() ? 'on' : 'off'}`,
      ].join('\n'),
    });
  }

  private async runClose(interaction: ChatInputCommandInteraction): Promise<void> {
    const context = await this.ticketContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (ticket.status !== 'open') {
      await interaction.reply({content: 'This ticket is already closed.', ephemeral: true});
      return;
    }

    if (!staffCanManage(member, await getSettings(ticket.guildId)) && member.id !== ticket.openerId) {
      await interaction.reply({content: 'Only the person who opened this ticket or the DroidFix team can close it.', ephemeral: true});
      return;
    }

    const reason = interaction.options.getString('reason', false)?.trim() ?? '';
    await interaction.reply({content: 'Closing and saving the transcript…', ephemeral: true});
    await closeTicket({channel, ticket, closedBy: member, reason});
    await interaction.editReply('Closed. Transcript saved.');
  }

  private async runAccess(
    interaction: ChatInputCommandInteraction,
    action: 'add' | 'remove',
  ): Promise<void> {
    const context = await this.ticketContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (!staffCanManage(member, await getSettings(ticket.guildId))) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    const user = interaction.options.getUser('user', true);

    if (action === 'add') {
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      });
      await interaction.reply({content: `Added <@${user.id}> to this ticket.`, allowedMentions: {users: []}});
      return;
    }

    if (user.id === ticket.openerId) {
      await interaction.reply({content: 'That is the person who opened the ticket. Close it instead.', ephemeral: true});
      return;
    }

    await channel.permissionOverwrites.delete(user.id).catch(() => undefined);
    await interaction.reply({content: `Removed <@${user.id}> from this ticket.`, allowedMentions: {users: []}});
  }

  private async openForm(interaction: ButtonInteraction, kind: TicketKind): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({content: 'Tickets only work inside the DroidFix server.', ephemeral: true});
      return;
    }

    const key = `${interaction.user.id}:${kind}`;
    const last = lastOpen.get(key) ?? 0;
    if (Date.now() - last < OPEN_COOLDOWN_MS) {
      await interaction.reply({content: 'Give it a few seconds and press the button again.', ephemeral: true});
      return;
    }

    const [existing, panel] = await Promise.all([
      openTicketFor(interaction.guild.id, interaction.user.id, kind),
      fetchTicketPanel(),
    ]);
    if (interaction.channelId) {
      void rememberPanel(interaction.guild.id, interaction.channelId, interaction.message.id);
    }

    if (existing && interaction.guild.channels.cache.has(existing.channelId)) {
      await interaction.reply({
        content: `You already have an open ticket: <#${existing.channelId}>. Use that one.`,
        ephemeral: true,
      });
      return;
    }

    if (!ticketKindOpen(kind, panel)) {
      await editPanelMessage(interaction.message, panel).catch(() => undefined);
      await interaction.reply({
        content: ticketKindClosedNote(kind, panel),
        ephemeral: true,
      });
      return;
    }

    // A modal must be the first response: never defer before showModal.
    await interaction.showModal(ticketModal(kind) as never);
    lastOpen.set(key, Date.now());
  }

  private async askClose(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {ticket, member} = context;
    const settings = await getSettings(ticket.guildId);
    if (!staffCanManage(member, settings) && member.id !== ticket.openerId) {
      await interaction.reply({content: 'Only the person who opened this ticket or the DroidFix team can close it.', ephemeral: true});
      return;
    }

    await interaction.reply({
      content: 'Are you sure you would like to close this ticket?',
      components: [closeConfirmRow()],
      ephemeral: true,
    });
  }

  private async confirmClose(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (ticket.status !== 'open') {
      await interaction.update({content: 'Already closed.', components: []});
      return;
    }

    await interaction.update({content: 'Closing and saving the transcript…', components: []});
    await closeTicket({channel, ticket, closedBy: member, reason: ''});
    await interaction.editReply({content: 'Closed. Transcript saved.', components: []});
  }

  private async claim(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {ticket, member} = context;
    if (!staffCanManage(member, await getSettings(ticket.guildId))) {
      await interaction.reply({content: 'Staff only. Andrew will be with you as soon as he can.', ephemeral: true});
      return;
    }

    if (ticket.claimedById && ticket.claimedById !== member.id) {
      await interaction.reply({content: `Already claimed by ${ticket.claimedByTag}.`, ephemeral: true});
      return;
    }

    const tag = userTag(member.user);
    await patchTicket(ticket.channelId, {claimedById: member.id, claimedByTag: tag});
    await interaction.reply({content: `**${tag}** has picked this ticket up.`});
  }

  private async sendTranscript(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (!staffCanManage(member, await getSettings(ticket.guildId))) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    await interaction.deferReply({ephemeral: true});
    const saved = await saveTranscript({channel, ticket, postToLog: true});
    await interaction.editReply(
      saved.url
        ? `Transcript saved (${String(saved.messageCount)} messages): ${saved.url}`
        : `Transcript posted to the log channel (${String(saved.messageCount)} messages). The website copy did not save, so check DROIDFIX_BOT_TOKEN.`,
    );
  }

  private async reopen(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (!staffCanManage(member, await getSettings(ticket.guildId))) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    if (ticket.status === 'open') {
      await interaction.reply({content: 'This ticket is already open.', ephemeral: true});
      return;
    }

    await interaction.deferReply({ephemeral: true});
    await reopenTicket({channel, ticket, reopenedBy: member});
    await interaction.editReply('Reopened.');
  }

  private async askDelete(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    if (!staffCanManage(context.member, await getSettings(context.ticket.guildId))) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    await interaction.reply({
      content: 'Delete this channel for good? The transcript is saved to the website and the log channel first.',
      components: [deleteConfirmRow()],
      ephemeral: true,
    });
  }

  private async confirmDelete(interaction: ButtonInteraction): Promise<void> {
    const context = await this.buttonContext(interaction);
    if (!context) {
      return;
    }

    const {channel, ticket, member} = context;
    if (!staffCanManage(member, await getSettings(ticket.guildId))) {
      await interaction.reply({content: 'Staff only.', ephemeral: true});
      return;
    }

    await interaction.update({content: 'Saving the transcript, then deleting…', components: []});
    await deleteTicket({channel, ticket, deletedBy: member});
  }

  private async buttonContext(interaction: ButtonInteraction): Promise<{
    channel: TextChannel;
    ticket: TicketRecord;
    member: GuildMember;
  } | undefined> {
    if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({content: 'Use this inside a ticket channel.', ephemeral: true});
      return undefined;
    }

    const ticket = await ticketForChannel(interaction.channel.id);
    if (!ticket) {
      await interaction.reply({
        content: 'I have no record of this ticket. It was probably made before the ticket system, or the data file was reset.',
        ephemeral: true,
      });
      return undefined;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({content: 'Could not read your server profile. Try again.', ephemeral: true});
      return undefined;
    }

    return {channel: interaction.channel, ticket, member};
  }

  private async ticketContext(interaction: ChatInputCommandInteraction): Promise<{
    channel: TextChannel;
    ticket: TicketRecord;
    member: GuildMember;
  } | undefined> {
    if (!interaction.guild || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({content: 'Use this inside a ticket channel.', ephemeral: true});
      return undefined;
    }

    const ticket = await ticketForChannel(interaction.channel.id);
    if (!ticket) {
      await interaction.reply({content: 'This is not a ticket channel.', ephemeral: true});
      return undefined;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({content: 'Could not read your server profile. Try again.', ephemeral: true});
      return undefined;
    }

    return {channel: interaction.channel, ticket, member};
  }
}
