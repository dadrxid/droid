import {Client} from 'discord.js';

let activeClient: Client | null = null;

export function setActiveDiscordClient(client: Client): void {
  activeClient = client;
}

export function getActiveDiscordClient(): Client {
  if (!activeClient) {
    throw new Error('Discord client is not initialized yet');
  }

  return activeClient;
}
