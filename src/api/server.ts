import express from 'express';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export const app = express();

app.use(express.json());

export function startServer(): void {
  app.listen(config.PORT, () => {
    logger.info(`API server listening on port ${config.PORT}`);
  });
}

startServer();
