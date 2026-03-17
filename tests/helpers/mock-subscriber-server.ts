import express from 'express';
import { createServer } from 'http';

interface ReceivedRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export async function createMockServer() {
  const mockApp = express();
  mockApp.use(express.json());

  const received: ReceivedRequest[] = [];
  let responseStatus = 200;

  mockApp.post('*', (req, res) => {
    received.push({ body: req.body, headers: req.headers });
    res.status(responseStatus).json({ ok: true });
  });

  const server = createServer(mockApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const url = `http://localhost:${address.port}`;

  return {
    url,
    getReceivedRequests: (): ReceivedRequest[] => [...received],
    setResponseStatus: (code: number): void => {
      responseStatus = code;
    },
    reset: (): void => {
      received.length = 0;
      responseStatus = 200;
    },
    stop: (): Promise<void> =>
      new Promise((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
