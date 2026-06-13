export default function installProcessStabilityHandlers(): void {
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('Unhandled promise rejection (process stays alive):', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught exception (process stays alive):', error);
  });
}
