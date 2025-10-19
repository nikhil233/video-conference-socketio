import { appConfig } from './config';
import { Server } from './Server';
import { Logger } from './Logger';

const logger = new Logger('main');

async function run(): Promise<void> {
  logger.info('Starting server...');

  try {
    const server = await Server.create({ config: appConfig });
    
    // Handle graceful shutdown
    const shutdown = async (): Promise<void> => {
      logger.info('Shutting down gracefully...');
      
      try {
        await server.close();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown: %s', (error as Error).message);
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    await server.run();
  } catch (error) {
    logger.error('Failed to start server: %s', (error as Error).message);
    process.exit(1);
  }
}

run().catch((error) => {
  logger.error('Unhandled error: %s', error.message);
  process.exit(1);
});
