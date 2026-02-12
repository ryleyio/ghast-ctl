/**
 * Utility functions for port finding, process management, etc.
 */

import net from 'net';
import { exec, spawn } from 'child_process';
import path from 'path';
import http from 'http';

/**
 * Find an available port in the given ranges (avoiding 8XXX)
 */
export async function findAvailablePort(): Promise<number> {
  const ranges: [number, number][] = [
    [3000, 3999],
    [4000, 4999],
    [5000, 5999],
    [6000, 6999],
    [7000, 7999],
    [9000, 9999],
  ];

  // Pick a random range first
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  const [min, max] = range;

  // Try random ports in that range
  for (let attempts = 0; attempts < 100; attempts++) {
    const port = Math.floor(Math.random() * (max - min + 1)) + min;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }

  // Fallback: scan sequentially
  for (const [min, max] of ranges) {
    for (let port = min; port <= max; port++) {
      const available = await isPortAvailable(port);
      if (available) {
        return port;
      }
    }
  }

  throw new Error('No available port found');
}

/**
 * Check if a port is available
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Extract app name from .app path
 */
export function getAppName(appPath: string): string {
  const basename = path.basename(appPath);
  return basename.replace(/\.app$/i, '');
}

/**
 * Kill a running macOS app by its .app path
 */
export function killApp(appPath: string): Promise<void> {
  return new Promise((resolve) => {
    const appName = getAppName(appPath);

    // Try multiple methods to ensure the app is killed
    exec(`pkill -9 -f "${appPath}/Contents/MacOS"`, () => {
      exec(`killall -9 "${appName}"`, () => {
        exec(`osascript -e 'quit app "${appName}"'`, () => {
          setTimeout(resolve, 500);
        });
      });
    });
  });
}

/**
 * Launch an Electron app with remote debugging enabled
 */
export function launchElectronApp(appPath: string, debugPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('open', [
      '-a', appPath,
      '--args',
      `--remote-debugging-port=${debugPort}`
    ], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to launch app, exit code: ${code}`));
      }
    });
  });
}

/**
 * Wait for CDP endpoint to become available
 */
export async function waitForCDP(port: number, timeout = 30000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  throw new Error(`CDP endpoint not available on port ${port} after ${timeout}ms`);
}
