/**
 * Express server with mutex for command execution
 */

import express, { Request, Response } from 'express';
import type { Browser, Page } from 'puppeteer';
import { executeCommand } from './commands.js';
import { History } from './history.js';

interface ServerContext {
  browser: Browser;
  page: Page;
  setPage: (page: Page) => void;
  wasConnected: boolean;
}

/**
 * Create and start the Express server
 */
export function createServer(ctx: ServerContext, port: number): Promise<void> {
  const app = express();
  app.use(express.json());

  const history = new History();
  let commandLock = false;

  // Mutex wrapper for command execution
  const withLock = async <T>(fn: () => Promise<T>): Promise<T> => {
    while (commandLock) {
      await new Promise(r => setTimeout(r, 50));
    }
    commandLock = true;
    try {
      return await fn();
    } finally {
      commandLock = false;
    }
  };

  // POST /cmd - Execute a command
  app.post('/cmd', async (req: Request, res: Response) => {
    const { command } = req.body as { command?: string };

    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'Missing or invalid command' });
      return;
    }

    try {
      const result = await withLock(async () => {
        const urlBefore = ctx.page.url();
        const cmdResult = await executeCommand({ page: ctx.page, browser: ctx.browser }, command);
        const urlAfter = ctx.page.url();

        // Update active page if tab switching occurred
        if (command.startsWith('switch-tab') || command.startsWith('new-tab')) {
          const pages = await ctx.browser.pages();
          if (command.startsWith('switch-tab')) {
            const idx = parseInt(command.split(' ')[1]);
            if (idx >= 0 && idx < pages.length) {
              ctx.setPage(pages[idx]);
            }
          } else if (command.startsWith('new-tab')) {
            ctx.setPage(pages[pages.length - 1]);
          }
        }

        // Record to history
        history.record({
          command,
          urlBefore,
          urlAfter,
          result: cmdResult.contentType === 'image' ? '[binary image]' : cmdResult.data,
          success: cmdResult.success
        });

        return cmdResult;
      });

      if (!result.success) {
        res.status(400);
      }

      // Send response based on content type
      if (result.contentType === 'image' && result.binary) {
        res.type('image/png').send(result.binary);
      } else if (result.contentType === 'html') {
        res.type('text/html').send(result.data as string);
      } else {
        res.json(result.success ? (result.data ?? { success: true }) : { error: result.error });
      }
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // GET /history - Return timeline
  app.get('/history', (_req: Request, res: Response) => {
    res.json(history.getAll());
  });

  // GET /health - Status check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      browserConnected: ctx.browser.connected,
      historyEntries: history.length
    });
  });

  // POST /shutdown - Graceful shutdown
  app.post('/shutdown', async (_req: Request, res: Response) => {
    res.json({ message: 'Shutting down' });

    setTimeout(async () => {
      try {
        if (ctx.wasConnected) {
          // Just disconnect, don't close the browser we connected to
          ctx.browser.disconnect();
        } else {
          // We launched this browser, so close it
          await ctx.browser.close();
        }
      } catch {
        // Ignore close errors
      }
      process.exit(0);
    }, 100);
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      resolve();
    });
    server.on('error', reject);
  });
}
