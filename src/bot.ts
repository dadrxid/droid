import {Client, Collection, User} from 'discord.js';
import {inject, injectable} from 'inversify';
import ora, {Ora} from 'ora';
import {TYPES} from './types.js';
import container from './inversify.config.js';
import Command from './commands/index.js';
import debug from './utils/debug.js';
import handleGuildCreate from './events/guild-create.js';
import handleVoiceStateUpdate from './events/voice-state-update.js';
import handleGuildMemberAdd from './events/guild-member-add.js';
import errorMsg from './utils/error-msg.js';
import {isUserInVoice} from './utils/channels.js';
import Config from './services/config.js';
import {generateDependencyReport} from '@discordjs/voice';
import {REST} from '@discordjs/rest';
import {Routes} from 'discord-api-types/v10';
import registerCommandsOnGuild from './utils/register-commands-on-guild.js';
import {isInvalidDiscordTokenError, waitBeforeDiscordLoginRetry} from './utils/discord-login-retry.js';
import createDiscordClient from './utils/create-discord-client.js';
import {setActiveDiscordClient} from './utils/discord-client-holder.js';

@injectable()
export default class {
  private client!: Client;
  private readonly config: Config;
  private readonly shouldRegisterCommandsOnBot: boolean;
  private readonly commandsByName!: Collection<string, Command>;
  private readonly commandsByButtonId!: Collection<string, Command>;
  private isReconnecting = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(@inject(TYPES.Config) config: Config) {
    this.config = config;
    this.shouldRegisterCommandsOnBot = config.REGISTER_COMMANDS_ON_BOT;
    this.commandsByName = new Collection();
    this.commandsByButtonId = new Collection();
  }

  public async register(): Promise<void> {
    for (const command of container.getAll<Command>(TYPES.Command)) {
      try {
        command.slashCommand.toJSON();
      } catch (error) {
        console.error(error);
        throw new Error(`Could not serialize /${command.slashCommand.name ?? ''} to JSON`);
      }

      if (command.slashCommand.name) {
        this.commandsByName.set(command.slashCommand.name, command);
      }

      if (command.handledButtonIds) {
        for (const buttonId of command.handledButtonIds) {
          this.commandsByButtonId.set(buttonId, command);
        }
      }
    }

    this.client = createDiscordClient();
    setActiveDiscordClient(this.client);

    const spinner = ora('📡 connecting to Discord...').start();
    this.attachClientListeners(this.client, spinner);
    await this.loginUntilReady(spinner);
  }

  private async loginUntilReady(spinner: Ora): Promise<void> {
    let loginAttempt = 0;

    for (;;) {
      loginAttempt += 1;

      try {
        // eslint-disable-next-line no-await-in-loop -- intentional backoff when Discord rate-limits session starts
        await this.client.login(this.config.DISCORD_TOKEN);
        return;
      } catch (error: unknown) {
        if (isInvalidDiscordTokenError(error)) {
          spinner.fail('Invalid DISCORD_TOKEN — fix it in Portainer and redeploy');
          console.error(error);
          process.exit(1);
        }

        spinner.stop();
        this.replaceClient(spinner);
        // eslint-disable-next-line no-await-in-loop -- must wait between login attempts
        await waitBeforeDiscordLoginRetry(error, loginAttempt);
        spinner.start('📡 connecting to Discord...');
      }
    }
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startHeartbeat(client: Client, spinner: Ora): void {
    this.clearHeartbeat();

    let missedHeartbeats = 0;

    this.heartbeatTimer = setInterval(() => {
      if (client !== this.client) {
        this.clearHeartbeat();
        return;
      }

      if (client.isReady()) {
        missedHeartbeats = 0;
        debug(`Discord heartbeat: ping ${client.ws.ping}ms, ${String(client.guilds.cache.size)} guilds`);
        return;
      }

      missedHeartbeats += 1;
      console.warn(`Discord client not ready (${missedHeartbeats}/5 heartbeat checks)`);

      if (missedHeartbeats >= 5 && !this.isReconnecting) {
        missedHeartbeats = 0;
        void this.reconnectClient(spinner);
      }
    }, 60_000);
  }

  private async reconnectClient(spinner: Ora): Promise<void> {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;

    try {
      console.warn('Discord connection lost — recreating client instead of exiting...');
      spinner.stop();
      this.replaceClient(spinner);
      spinner.start('📡 reconnecting to Discord...');
      await this.loginUntilReady(spinner);
    } finally {
      this.isReconnecting = false;
    }
  }

  private replaceClient(spinner: Ora): void {
    this.clearHeartbeat();

    try {
      this.client.removeAllListeners();
      this.client.destroy();
    } catch {
      // ignore cleanup errors before retry
    }

    this.client = createDiscordClient();
    setActiveDiscordClient(this.client);
    this.attachClientListeners(this.client, spinner);
  }

  private attachClientListeners(client: Client, spinner: Ora): void {
    // eslint-disable-next-line complexity
    client.on('interactionCreate', async interaction => {
      try {
        if (interaction.isCommand()) {
          const command = this.commandsByName.get(interaction.commandName);

          if (!command || !interaction.isChatInputCommand()) {
            return;
          }

          if (!interaction.guild) {
            await interaction.reply(errorMsg('you can\'t use this bot in a DM'));
            return;
          }

          const requiresVC = command.requiresVC instanceof Function ? command.requiresVC(interaction) : command.requiresVC;
          if (requiresVC && interaction.member && !isUserInVoice(interaction.guild, interaction.member.user as User)) {
            await interaction.reply({content: errorMsg('gotta be in a voice channel'), ephemeral: true});
            return;
          }

          if (command.execute) {
            await command.execute(interaction);
          }
        } else if (interaction.isButton()) {
          const command = this.commandsByButtonId.get(interaction.customId);

          if (!command) {
            return;
          }

          if (command.handleButtonInteraction) {
            await command.handleButtonInteraction(interaction);
          }
        } else if (interaction.isAutocomplete()) {
          const command = this.commandsByName.get(interaction.commandName);

          if (!command) {
            return;
          }

          if (command.handleAutocompleteInteraction) {
            await command.handleAutocompleteInteraction(interaction);
          }
        }
      } catch (error: unknown) {
        debug(error);

        try {
          if ((interaction.isCommand() || interaction.isButton()) && (interaction.replied || interaction.deferred)) {
            await interaction.editReply(errorMsg(error as Error));
          } else if (interaction.isCommand() || interaction.isButton()) {
            await interaction.reply({content: errorMsg(error as Error), ephemeral: true});
          }
        } catch {}
      }
    });

    client.once('ready', async () => {
      debug(generateDependencyReport());

      const rest = new REST({version: '10'}).setToken(this.config.DISCORD_TOKEN);
      if (this.shouldRegisterCommandsOnBot) {
        spinner.text = '📡 updating commands on bot...';
        await rest.put(
          Routes.applicationCommands(client.user!.id),
          {body: this.commandsByName.map(command => command.slashCommand.toJSON())},
        );
      } else {
        spinner.text = '📡 updating commands in all guilds...';

        await Promise.all([
          ...client.guilds.cache.map(async guild => {
            await registerCommandsOnGuild({
              rest,
              guildId: guild.id,
              applicationId: client.user!.id,
              commands: this.commandsByName.map(c => c.slashCommand),
            });
          }),
          rest.put(Routes.applicationCommands(client.user!.id), {body: []}),
        ],
        );
      }

      client.user!.setPresence({
        activities: [
          {
            name: this.config.BOT_ACTIVITY,
            type: this.config.BOT_ACTIVITY_TYPE,
            url: this.config.BOT_ACTIVITY_URL === '' ? undefined : this.config.BOT_ACTIVITY_URL,
          },
        ],
        status: this.config.BOT_STATUS,
      });

      spinner.succeed(`Ready! Invite the bot with https://discordapp.com/oauth2/authorize?client_id=${client.user?.id ?? ''}&scope=bot%20applications.commands&permissions=36700160`);
      this.startHeartbeat(client, spinner);
    });

    client.on('error', console.error);
    client.on('debug', debug);
    client.on('shardDisconnect', (event, shardId) => {
      console.warn(`Discord shard ${String(shardId)} disconnected (${event.code}): ${event.reason || 'no reason'} — reconnecting automatically`);
    });
    client.on('shardReconnect', shardId => {
      console.warn(`Discord shard ${String(shardId)} reconnecting...`);
    });
    client.on('shardResume', (shardId, replayedEvents) => {
      console.warn(`Discord shard ${String(shardId)} resumed (${String(replayedEvents)} events replayed)`);
    });
    client.on('shardError', (error, shardId) => {
      console.error(`Discord shard ${shardId} error:`, error);
    });

    client.on('guildCreate', handleGuildCreate);
    client.on('voiceStateUpdate', handleVoiceStateUpdate);
    client.on('guildMemberAdd', handleGuildMemberAdd);
  }
}
