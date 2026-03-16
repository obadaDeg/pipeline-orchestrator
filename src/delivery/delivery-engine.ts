import { config } from '../config.js';
import { db } from '../db/index.js';
import { deliveryAttempts } from '../db/schema.js';
import { calculateBackoff, sleep } from './backoff.js';
import { deliverPayload } from './http-client.js';

type SubscriberInfo = {
  id: string;
  url: string;
};

export async function runDelivery(
  jobId: string,
  subscribers: SubscriberInfo[],
  processedPayload: unknown,
): Promise<{ allSucceeded: boolean }> {
  let allSucceeded = true;

  for (const subscriber of subscribers) {
    let subscriberSucceeded = false;

    for (let attempt = 1; attempt <= config.DELIVERY_MAX_RETRIES; attempt++) {
      const result = await deliverPayload(subscriber.url, processedPayload);

      await db.insert(deliveryAttempts).values({
        jobId,
        subscriberId: subscriber.id,
        subscriberUrl: subscriber.url,
        httpStatus: result.httpStatus,
        responseSnippet: result.responseSnippet,
        attemptNumber: attempt,
        outcome: result.success ? 'SUCCESS' : 'FAILED',
      });

      if (result.success) {
        subscriberSucceeded = true;
        break;
      }

      // Sleep between retries, not after the final attempt
      if (attempt < config.DELIVERY_MAX_RETRIES) {
        await sleep(calculateBackoff(attempt, config.DELIVERY_BACKOFF_MS));
      }
    }

    if (!subscriberSucceeded) {
      allSucceeded = false;
    }
  }

  return { allSucceeded };
}
