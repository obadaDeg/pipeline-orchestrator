import { Router } from 'express';
import { methodNotAllowed, receiveWebhook } from '../controllers/webhooks.controller.js';
import { bodySizeLimit } from '../middleware/body-size-limit.js';

export const webhooksRouter = Router();

// bodySizeLimit must run first — it buffers the raw stream and sets req.rawBody.
// This router must be mounted in server.ts BEFORE global body parsers so the
// stream is not already consumed when bodySizeLimit runs.
webhooksRouter.post('/:sourceId', bodySizeLimit, receiveWebhook);
webhooksRouter.all('/:sourceId', methodNotAllowed);
