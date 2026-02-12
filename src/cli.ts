#!/usr/bin/env node

/**
 * ghast-ctl - Browser/Electron automation CLI
 */

import { launchBrowser, connectToPort, connectToElectron } from './browser.js';
import { createServer } from './server.js';
import { findAvailablePort } from './utils.js';
import http from 'http';

interface StartOptions {
  stealth: boolean;
  headless: boolean;
  electronApp?: string;
  port?: number;
}

interface ControlOptions {
  server: number;
  command: string;
}

function parseArgs(args: string[]): { subcommand: string; options: Record<string, string | boolean> } {
  const subcommand = args[0] || 'help';
  const options: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (!options._command) {
      options._command = arg;
    }
  }

  return { subcommand, options };
}

async function start(options: StartOptions): Promise<void> {
  const { stealth, headless, electronApp, port: existingPort } = options;

  let connection;

  if (existingPort) {
    // Connect to existing CDP port
    if (stealth) {
      console.error('Warning: Stealth plugin not available when connecting to existing port. JS evasions will still be injected.');
    }
    connection = await connectToPort(existingPort, stealth);
  } else if (electronApp) {
    // Launch Electron app
    if (stealth) {
      console.error('Warning: Stealth plugin not available for Electron apps. JS evasions will still be injected.');
    }
    connection = await connectToElectron(electronApp, stealth);
  } else {
    // Launch fresh browser
    connection = await launchBrowser({ headless, stealth });
  }

  const { browser, page, wasConnected } = connection;
  let activePage = page;

  // Find port for Express server
  const serverPort = await findAvailablePort();

  // Create server context with page setter
  const ctx = {
    browser,
    get page() { return activePage; },
    setPage: (p: typeof page) => { activePage = p; },
    wasConnected
  };

  await createServer(ctx, serverPort);

  // Output the port to stdout (this is the key output for callers to capture)
  console.log(serverPort);

  // Keep process alive
  process.on('SIGINT', async () => {
    await browser.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await browser.close();
    process.exit(0);
  });
}

async function control(options: ControlOptions): Promise<void> {
  const { server, command } = options;

  return new Promise((resolve) => {
    const postData = JSON.stringify({ command });

    const req = http.request({
      hostname: '127.0.0.1',
      port: server,
      path: '/cmd',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';

        if (contentType.includes('image/png')) {
          // Write binary to stdout
          process.stdout.write(body);
        } else {
          // Write text to stdout
          process.stdout.write(body.toString());
          process.stdout.write('\n');
        }

        // Exit with appropriate code
        const statusOk = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        process.exit(statusOk ? 0 : 1);
      });
    });

    req.on('error', (err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });

    req.write(postData);
    req.end();
  });
}

async function stop(serverPort: number): Promise<void> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: serverPort,
      path: '/shutdown',
      method: 'POST'
    }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        console.log('Shutdown signal sent');
        process.exit(0);
      });
    });

    req.on('error', (err) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });

    req.end();
  });
}

function showHelp(): void {
  console.log(`
ghast-ctl - Browser/Electron automation CLI

USAGE:
  ghast-ctl start [options]              Start browser daemon
  ghast-ctl control --server PORT "cmd"  Send command to daemon
  ghast-ctl stop --server PORT           Stop daemon

START OPTIONS:
  --stealth       Enable stealth mode (fresh browser only)
  --headless      Run browser headless (fresh browser only)
  --electronApp   Path to .app bundle to launch
  --port          Connect to existing CDP port

EXAMPLES:
  # Start fresh browser
  ghast-ctl start

  # Start with stealth
  ghast-ctl start --stealth

  # Connect to existing Chrome with debugging
  ghast-ctl start --port 9222

  # Launch Electron app
  ghast-ctl start --electronApp /Applications/Slack.app

  # Send commands (capture port from start output)
  PORT=$(ghast-ctl start &)
  ghast-ctl control --server $PORT "navigate https://example.com"
  ghast-ctl control --server $PORT "screenshot"
  ghast-ctl stop --server $PORT

COMMANDS:
  Navigation:  navigate, navigate-force, back, forward, refresh
  Reading:     info, text, text-full, html, html-full, screenshot
               links, buttons, inputs, forms, interactive, cookies
  Interaction: click, type, clear-and-type, press, select, hover, scroll
  Waiting:     wait, wait-for
  Tabs:        tabs, new-tab, switch-tab, close-tab, close-other-tabs
  Other:       eval
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { subcommand, options } = parseArgs(args);

  switch (subcommand) {
    case 'start':
      await start({
        stealth: options.stealth === true,
        headless: options.headless === true,
        electronApp: typeof options.electronApp === 'string' ? options.electronApp : undefined,
        port: typeof options.port === 'string' ? parseInt(options.port) : undefined
      });
      break;

    case 'control':
      if (!options.server) {
        console.error('Error: --server PORT is required');
        process.exit(1);
      }
      const command = options._command as string;
      if (!command) {
        console.error('Error: command is required');
        process.exit(1);
      }
      await control({
        server: parseInt(options.server as string),
        command
      });
      break;

    case 'stop':
      if (!options.server) {
        console.error('Error: --server PORT is required');
        process.exit(1);
      }
      await stop(parseInt(options.server as string));
      break;

    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp();
      break;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
