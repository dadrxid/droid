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

export interface SlashCommandSyncResult {
  succeeded: number;
  failed: number;
}

export async function syncSlashCommands({
  rest,
  client,
  commands,
  registerGlobally,
}: SyncSlashCommandsOptions): Promise<SlashCommandSyncResult> {
  const applicationId = client.user!.id;
  const payload = commands.map(command => command.slashCommand.toJSON());

  if (registerGlobally) {
    console.log(`Syncing ${String(payload.length)} slash commands globally...`);
    try {
      await rest.put(Routes.applicationCommands(applicationId), {body: payload});
      console.log('Global slash commands synced.');
      return {succeeded: 1, failed: 0};
    } catch (error: unknown) {
      console.error(`Failed to sync global slash commands: ${formatDiscordApiError(error)}`);
      return {succeeded: 0, failed: 1};
    }
  }

  console.log('Clearing global slash commands (using per-guild registration)...');
  try {
    await rest.put(Routes.applicationCommands(applicationId), {body: []});
  } catch (error: unknown) {
    console.warn(`Could not clear global slash commands (non-fatal): ${formatDiscordApiError(error)}`);
  }

  const guilds = [...client.guilds.cache.values()];
  console.log(`Syncing ${String(payload.length)} slash commands to ${String(guilds.length)} guild(s)...`);

  let succeeded = 0;
  let failed = 0;

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
      succeeded += 1;
    } catch (error: unknown) {
      failed += 1;
      console.error(`Failed to sync slash commands for guild ${guild.name} (${guild.id}): ${formatDiscordApiError(error)}`);
    }
  }

  if (failed > 0) {
    console.warn(
      `Slash command sync finished with ${String(failed)} failure(s) and ${String(succeeded)} success(es). `
      + 'The bot stays online — music and existing commands keep working. Retries on next restart.',
    );
  }

  return {succeeded, failed};
}
