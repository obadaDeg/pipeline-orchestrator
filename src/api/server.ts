import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { logger } from '../lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.router.js';
import { jobsRouter } from './routes/jobs.router.js';
import { pipelinesRouter } from './routes/pipelines.router.js';
import { statsRouter } from './routes/stats.router.js';
import { teamsRouter } from './routes/teams.router.js';
import { webhooksRouter } from './routes/webhooks.router.js';

export const app = express();

// webhooks router MUST be mounted BEFORE express.json() — the bodySizeLimit
// middleware inside reads the raw request stream. If express.json() ran first,
// the stream would already be consumed and rawBody would be empty.
app.use('/webhooks', webhooksRouter);

// Body parsing for all other routes
app.use(express.json());

app.use('/auth', authRouter);
app.use('/pipelines', pipelinesRouter);
app.use('/jobs', jobsRouter);
app.use('/stats', statsRouter);
app.use('/teams', teamsRouter);

// Dashboard SPA — serve static assets and catch-all for client-side routing
// Must come AFTER all API routes so /auth, /pipelines, /jobs etc. are not shadowed
const dashboardDir = path.join(__dirname, '../../public/dashboard');
app.use('/dashboard', express.static(dashboardDir));
app.get('/dashboard/*', (_req, res) => {
  res.sendFile(path.join(dashboardDir, 'index.html'));
});

// Error handler must be last — Express identifies 4-argument functions as error handlers
app.use(errorHandler);

export function startServer(): void {
  app.listen(config.PORT, () => {
    logger.info(`API server listening on port ${config.PORT}`);
  });
}
