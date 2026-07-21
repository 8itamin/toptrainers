import express from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The showcase remains deployable as a static CSR shell while the block API
// evolves. This keeps the public surface available even when Angular SSR
// manifest generation differs between framework patch releases.
const browserDistFolder = resolve(fileURLToPath(new URL('../browser', import.meta.url)));
const app = express();

app.use(express.static(browserDistFolder, { maxAge: '1y', index: false, redirect: false }));

app.get('/{*splat}', async (_request, response, next) => {
  try {
    response.type('html').send(await readFile(resolve(browserDistFolder, 'index.csr.html'), 'utf8'));
  } catch (error) {
    next(error);
  }
});

const requestedPort = Number.parseInt(process.env['PORT'] ?? '4000', 10);
const port = Number.isNaN(requestedPort) ? 4000 : requestedPort;
app.listen(port, '0.0.0.0', () => {
  console.info(`TopTrainers showcase listening on http://0.0.0.0:${port}`);
});
