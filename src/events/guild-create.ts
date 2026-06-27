import {Guild} from 'discord.js';
import container from '../inversify.config.js';
import Command from '../commands/index.js';
import {TYPES} from '../types.js';
import Config from '../services/config.js';
import {prisma} from '../utils/db.js';
import {REST} from '@discordjs/rest';
import {Setting} from '@prisma/client';
import registerCommandsOnGuild from '../utils/register-commands-on-guild.js';
import {getActiveDiscordClient} from '../utils/discord-client-holder.js';

export async function createGuildSettings(guildId: string): Promise<Setting> {
  return prisma.setting.upsert({
    where: {
      guildId,
    },
    create: {
      guildId,
      autoAnnounceNextSong: true,
    },
    update: {},
  });
}

export default async (guild: Guild): Promise<void> => {
  await createGuildSettings(guild.id);

  const config = container.get<Config>(TYPES.Config);

  if (!config.REGISTER_COMMANDS_ON_BOT) {
    const client = getActiveDiscordClient();
    const rest = new REST({version: '10'}).setToken(config.DISCORD_TOKEN);

    try {
      await registerCommandsOnGuild({
        rest,
        applicationId: client.user!.id,
        guildId: guild.id,
        commands: container.getAll<Command>(TYPES.Command).map(command => command.slashCommand),
      });
    } catch (error: unknown) {
      console.error(`Failed to register slash commands for new guild ${guild.name} (${guild.id}):`, error);
    }
  }
};
