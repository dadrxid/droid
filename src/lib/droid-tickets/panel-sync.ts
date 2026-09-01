import {
  ChannelType,
  type Client,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js';
import {brandEmoji} from '../droid-brand.js';
import {
  fetchTicketGates,
  panelThumbnailUrl,
  ticketGateStamp,
  ticketGatesLive,
  type TicketGates,
} from './site.js';
import {getSettings, listTrackedPanels, saveSettings} from './store.js';
import {panelEmbed, panelRows} from './ui.js';

const PANEL_ART = 'dr3d';
const RECOVER_MS = 120_000;

export function livePanelStamp(gates: TicketGates): string {
  return `${PANEL_ART}|${ticketGateStamp(gates)}`;
}

function isPanelMessage(message: Message): boolean {
  if (message.author.id !== message.client.user?.id) {
    return false;
  }

  return message.components.some(row =>
    row.components.some(component => {
      const id = 'customId' in component ? component.customId : '';
      return id === 'dt:new:custom' || id === 'dt:new:repair';
    }),
  );
}

export function panelPayload(guild: Guild | null | undefined, gates: TicketGates) {
  const emoji = brandEmoji(guild);
  return {
    embeds: [panelEmbed(emoji, panelThumbnailUrl(), gates)],
    components: panelRows(emoji, gates),
  };
}

export async function rememberPanel(guildId: string, channelId: string, messageId: string, stamp?: string): Promise<void> {
  const settings = await getSettings(guildId);
  if (
    settings.panelChannelId === channelId
    && settings.panelMessageId === messageId
    && (stamp === undefined || settings.panelStamp === stamp)
  ) {
    return;
  }

  await saveSettings(guildId, {
    panelChannelId: channelId,
    panelMessageId: messageId,
    ...(stamp === undefined ? {} : {panelStamp: stamp}),
  });
}

export async function findExistingPanel(channel: TextChannel): Promise<Message | null> {
  const settings = await getSettings(channel.guild.id);
  if (settings.panelMessageId) {
    const saved = await channel.messages.fetch(settings.panelMessageId).catch(() => null);
    if (saved && isPanelMessage(saved)) {
      return saved;
    }
  }

  const recent = await channel.messages.fetch({limit: 50}).catch(() => null);
  if (!recent) {
    return null;
  }

  return recent.find(message => isPanelMessage(message)) ?? null;
}

async function findPanelInGuild(guild: Guild): Promise<Message | null> {
  const texts = [...guild.channels.cache.values()]
    .filter(channel => channel.type === ChannelType.GuildText)
    .sort((a, b) => {
      const score = (name: string) => (/ticket|panel|support|order|create|repair/i.test(name) ? 0 : 1);
      return score(a.name) - score(b.name);
    })
    .slice(0, 20);

  /* eslint-disable no-await-in-loop */
  for (const channel of texts) {
    if (!('messages' in channel)) {
      continue;
    }

    const recent = await channel.messages.fetch({limit: 50}).catch(() => null);
    const found = recent?.find(message => isPanelMessage(message));
    if (found) {
      return found;
    }
  }
  /* eslint-enable no-await-in-loop */

  return null;
}

function isUnknownMessage(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as {code: number}).code === 10008);
}

export async function editPanelMessage(message: Message, gates: TicketGates): Promise<void> {
  if (!message.guild) {
    return;
  }

  const stamp = livePanelStamp(gates);
  const settings = await getSettings(message.guild.id);
  if (settings.panelMessageId === message.id && settings.panelStamp === stamp) {
    return;
  }

  await message.edit(panelPayload(message.guild, gates));
  await saveSettings(message.guild.id, {
    panelChannelId: message.channelId,
    panelMessageId: message.id,
    panelStamp: stamp,
  });
}

/** Keep the posted ticket panel in line with the staff desk Open/Closed buttons. */
export function startPanelSync(client: Client): void {
  setInterval(() => {
    void pushPanelCopy(client);
  }, 15_000);
  setInterval(() => {
    void recoverLostPanels(client);
  }, RECOVER_MS);
  void (async () => {
    await pushPanelCopy(client);
    await recoverLostPanels(client);
  })();
}

async function pushPanelCopy(client: Client): Promise<void> {
  const gates = await fetchTicketGates();
  if (!ticketGatesLive()) {
    return;
  }

  const stamp = livePanelStamp(gates);
  const panels = await listTrackedPanels();

  /* eslint-disable no-await-in-loop */
  for (const panel of panels) {
    if (panel.stamp === stamp) {
      continue;
    }

    const channel = await client.channels.fetch(panel.channelId).catch(() => null);
    if (!channel?.isTextBased() || !('messages' in channel)) {
      continue;
    }

    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (!message) {
      continue;
    }

    const guild = 'guild' in channel ? channel.guild : message.guild;
    try {
      await message.edit(panelPayload(guild, gates));
      await saveSettings(panel.guildId, {panelStamp: stamp});
    } catch (error: unknown) {
      if (isUnknownMessage(error)) {
        await saveSettings(panel.guildId, {panelChannelId: '', panelMessageId: '', panelStamp: ''});
      }
    }
  }
  /* eslint-enable no-await-in-loop */
}

async function recoverLostPanels(client: Client): Promise<void> {
  const gates = await fetchTicketGates();
  if (!ticketGatesLive()) {
    return;
  }

  const tracked = new Set((await listTrackedPanels()).map(panel => panel.guildId));

  /* eslint-disable no-await-in-loop */
  for (const guild of client.guilds.cache.values()) {
    if (tracked.has(guild.id)) {
      continue;
    }

    const settings = await getSettings(guild.id);
    if (!settings.categoryId) {
      continue;
    }

    const found = await findPanelInGuild(guild);
    if (!found) {
      continue;
    }

    try {
      await editPanelMessage(found, gates);
    } catch (error: unknown) {
      if (!isUnknownMessage(error)) {
        console.warn(`Ticket panel recover skipped for ${guild.id}:`, error);
      }
    }
  }
  /* eslint-enable no-await-in-loop */
}
