import {Client} from 'discord.js';
import {REST} from '@discordjs/rest';
import {Routes} from 'discord-api-types/v10';
import Command from '../commands/index.js';
import registerCommandsOnGuild from './register-commands-on-guild.js';

interface SyncSlashCommandsOptions {
  rest: REST;
  client: Client;
  commands: Command[];
  registerGlobally: boolean;
}

function formatDiscordApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'rawError' in error) {
    return JSON.stringify((error as {rawError: unknown}).rawError);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function syncSlashCommands({
  rest,
  client,
  commands,
  registerGlobally,
}: SyncSlashCommandsOptions): Promise<void> {
  const applicationId = client.user!.id;
  const payload = commands.map(command => command.slashCommand.toJSON());

  if (registerGlobally) {
    console.log(`Syncing ${String(payload.length)} slash commands globally...`);
    await rest.put(Routes.applicationCommands(applicationId), {body: payload});
    console.log('Global slash commands synced.');
    return;
  }

  console.log('Clearing global slash commands (using per-guild registration)...');
  await rest.put(Routes.applicationCommands(applicationId), {body: []});

  const guilds = [...client.guilds.cache.values()];
  console.log(`Syncing ${String(payload.length)} slash commands to ${String(guilds.length)} guild(s)...`);

  for (const guild of guilds) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential avoids Discord REST rate limits
      await registerCommandsOnGuild({
        rest,
        applicationId,
        guildId: guild.id,
        commands: commands.map(command => command.slashCommand),
      });
      console.log(`Slash commands synced for guild ${guild.name} (${guild.id})`);
    } catch (error: unknown) {
      console.error(`Failed to sync slash commands for guild ${guild.name} (${guild.id}): ${formatDiscordApiError(error)}`);
      throw error;
    }
  }
}
