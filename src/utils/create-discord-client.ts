import {Client, GatewayIntentBits} from 'discord.js';

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildVoiceStates,
];

export default function createDiscordClient(): Client {
  return new Client({intents});
}
