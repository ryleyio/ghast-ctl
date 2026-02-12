/**
 * Stealth evasion scripts for bot detection bypass
 */

import type { Page, Browser } from 'puppeteer';

export const STEALTH_SCRIPT = `
(function() {
  // Remove webdriver property
  Object.defineProperty(Navigator.prototype, 'webdriver', {
    get: function() { return false; },
    configurable: true,
    enumerable: true
  });
  try { delete Navigator.prototype.webdriver; } catch(e) {}
  Object.defineProperty(Navigator.prototype, 'webdriver', {
    get: () => undefined, configurable: true
  });

  // Mock plugins
  const mockPlugins = () => {
    const plugins = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
    ];
    const arr = Object.create(PluginArray.prototype);
    plugins.forEach((p, i) => {
      const plugin = Object.create(Plugin.prototype);
      Object.defineProperty(plugin, 'name', { value: p.name });
      Object.defineProperty(plugin, 'filename', { value: p.filename });
      Object.defineProperty(plugin, 'description', { value: p.description });
      Object.defineProperty(plugin, 'length', { value: 1 });
      Object.defineProperty(arr, i, { value: plugin, enumerable: true });
    });
    Object.defineProperty(arr, 'length', { value: plugins.length });
    return arr;
  };
  Object.defineProperty(navigator, 'plugins', { get: mockPlugins, configurable: true });

  // Chrome object
  window.chrome = window.chrome || {};
  window.chrome.runtime = { connect: function(){}, sendMessage: function(){} };
  window.chrome.app = { isInstalled: false };
  window.chrome.csi = function() { return { startE: Date.now() }; };
  window.chrome.loadTimes = function() { return { commitLoadTime: Date.now()/1000 }; };

  // Navigator properties
  const props = {
    languages: ['en-US', 'en'],
    language: 'en-US',
    platform: 'MacIntel',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    vendor: 'Google Inc.'
  };
  for (const [k, v] of Object.entries(props)) {
    try { Object.defineProperty(navigator, k, { get: () => v, configurable: true }); } catch(e) {}
  }

  // Screen properties
  const screenProps = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1055, colorDepth: 24 };
  for (const [k, v] of Object.entries(screenProps)) {
    try { Object.defineProperty(screen, k, { get: () => v, configurable: true }); } catch(e) {}
  }

  Object.defineProperty(window, 'outerWidth', { get: () => 1920, configurable: true });
  Object.defineProperty(window, 'outerHeight', { get: () => 1080, configurable: true });

  // WebGL vendor spoofing
  const getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(p) {
    if (p === 37445) return 'Intel Inc.';
    if (p === 37446) return 'Intel Iris OpenGL Engine';
    return getParam.call(this, p);
  };
})();
`;

export const STEALTH_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Inject stealth evasions into a page
 */
export async function injectStealth(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(STEALTH_SCRIPT);
  await page.setUserAgent(STEALTH_USER_AGENT);
}

/**
 * Setup stealth for all new pages in a browser
 */
export async function setupStealthForBrowser(browser: Browser): Promise<void> {
  const pages = await browser.pages();
  for (const page of pages) {
    await injectStealth(page);
  }

  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const page = await target.page();
      if (page) {
        await injectStealth(page);
      }
    }
  });
}
