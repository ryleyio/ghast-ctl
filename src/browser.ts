/**
 * Browser/Electron connection management
 */

import puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import { findAvailablePort, killApp, launchElectronApp, waitForCDP } from './utils.js';
import { setupStealthForBrowser, injectStealth } from './stealth.js';

let stealthLauncher: { launch: typeof puppeteer.launch } | null = null;

export interface BrowserConnection {
  browser: Browser;
  page: Page;
  cdpPort?: number;
  wasConnected: boolean;  // true if connected to existing, false if launched
}

async function getStealthLauncher(): Promise<{ launch: typeof puppeteer.launch }> {
  if (stealthLauncher) return stealthLauncher;

  // Dynamic import for puppeteer-extra (ESM compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteerExtra = (await import('puppeteer-extra')).default as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default as any;

  puppeteerExtra.use(StealthPlugin());
  stealthLauncher = puppeteerExtra as { launch: typeof puppeteer.launch };
  return stealthLauncher;
}

/**
 * Launch a fresh Chromium browser
 */
export async function launchBrowser(options: {
  headless?: boolean;
  stealth?: boolean;
} = {}): Promise<BrowserConnection> {
  const { headless = false, stealth = false } = options;

  const launchOptions = {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--window-size=1920,1080',
      '--enable-webgl',
      '--lang=en-US,en',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
  };

  const launcher = stealth ? await getStealthLauncher() : puppeteer;
  const browser = await launcher.launch(launchOptions);
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  if (stealth) {
    await injectStealth(page);
  }

  return { browser, page, wasConnected: false };
}

/**
 * Connect to an existing CDP port
 */
export async function connectToPort(port: number, stealth = false): Promise<BrowserConnection> {
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  if (stealth) {
    await setupStealthForBrowser(browser);
    await injectStealth(page);
  }

  return { browser, page, cdpPort: port, wasConnected: true };
}

/**
 * Launch and connect to an Electron app
 */
export async function connectToElectron(appPath: string, stealth = false): Promise<BrowserConnection> {
  await killApp(appPath);
  const cdpPort = await findAvailablePort();
  await launchElectronApp(appPath, cdpPort);
  await waitForCDP(cdpPort);

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${cdpPort}`,
    defaultViewport: null
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  if (stealth) {
    await setupStealthForBrowser(browser);
    await injectStealth(page);
  }

  return { browser, page, cdpPort, wasConnected: false };
}
