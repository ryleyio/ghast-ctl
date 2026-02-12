/**
 * Command parsing and execution
 */

import type { Page, Browser } from 'puppeteer';

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
  contentType?: 'json' | 'html' | 'image';
  binary?: Buffer;
}

interface CommandContext {
  page: Page;
  browser: Browser;
}

/**
 * Parse a command string into command and args
 */
export function parseCommand(input: string): { cmd: string; args: string[] } {
  const parts = input.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const cmd = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));
  return { cmd, args };
}

/**
 * Execute a command against the browser
 */
export async function executeCommand(
  ctx: CommandContext,
  input: string
): Promise<CommandResult> {
  const { cmd, args } = parseCommand(input);
  const { page, browser } = ctx;

  try {
    switch (cmd) {
      // Navigation
      case 'goto':
      case 'navigate': {
        const response = await page.goto(args[0], {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        return {
          success: true,
          data: { status: response?.status(), url: page.url() },
          contentType: 'json'
        };
      }

      case 'goto-force':
      case 'navigate-force': {
        const timeout = parseInt(args[1]) || 8000;
        let timedOut = false;

        const navPromise = page.goto(args[0], {
          waitUntil: 'domcontentloaded',
          timeout: timeout + 5000
        }).catch(() => null);

        const forcePromise = new Promise<'forced'>(resolve => {
          setTimeout(() => {
            timedOut = true;
            page.evaluate(() => window.stop()).catch(() => {});
            resolve('forced');
          }, timeout);
        });

        await Promise.race([navPromise, forcePromise]);
        await new Promise(r => setTimeout(r, 500));

        return {
          success: true,
          data: { forced: timedOut, url: page.url() },
          contentType: 'json'
        };
      }

      case 'back':
        await page.goBack({ waitUntil: 'networkidle2' });
        return { success: true, data: { url: page.url() }, contentType: 'json' };

      case 'forward':
        await page.goForward({ waitUntil: 'networkidle2' });
        return { success: true, data: { url: page.url() }, contentType: 'json' };

      case 'refresh':
        await page.reload({ waitUntil: 'networkidle2' });
        return { success: true, data: { url: page.url() }, contentType: 'json' };

      // Interactions
      case 'click':
        await page.waitForSelector(args[0], { timeout: 5000 });
        await page.click(args[0]);
        await waitForSettle(page);
        return { success: true, contentType: 'json' };

      case 'type':
        await page.waitForSelector(args[0], { timeout: 5000 });
        await page.type(args[0], args.slice(1).join(' '), { delay: 50 });
        return { success: true, contentType: 'json' };

      case 'clear-and-type':
        await page.waitForSelector(args[0], { timeout: 5000 });
        await page.click(args[0], { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type(args[0], args.slice(1).join(' '), { delay: 50 });
        return { success: true, contentType: 'json' };

      case 'press':
        await page.keyboard.press(args[0] as any);
        return { success: true, contentType: 'json' };

      case 'select':
        await page.waitForSelector(args[0], { timeout: 5000 });
        await page.select(args[0], args[1]);
        return { success: true, contentType: 'json' };

      case 'hover':
        await page.waitForSelector(args[0], { timeout: 5000 });
        await page.hover(args[0]);
        return { success: true, contentType: 'json' };

      case 'scroll':
        if (args[0] === 'down') {
          await page.evaluate((y) => window.scrollBy(0, y), parseInt(args[1]) || 500);
        } else if (args[0] === 'up') {
          await page.evaluate((y) => window.scrollBy(0, -y), parseInt(args[1]) || 500);
        } else if (args[0] === 'to') {
          await page.evaluate((sel) => {
            document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, args[1]);
        } else if (args[0] === 'bottom') {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } else if (args[0] === 'top') {
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        return { success: true, contentType: 'json' };

      // Waiting
      case 'wait':
        await new Promise(r => setTimeout(r, parseInt(args[0]) || 1000));
        return { success: true, contentType: 'json' };

      case 'wait-for':
        await page.waitForSelector(args[0], { timeout: parseInt(args[1]) || 10000 });
        return { success: true, contentType: 'json' };

      // Reading state
      case 'url':
      case 'info':
        return {
          success: true,
          data: { url: page.url(), title: await page.title() },
          contentType: 'json'
        };

      case 'text': {
        const text = await page.evaluate(() => document.body.innerText);
        return {
          success: true,
          data: { length: text.length, text: text.substring(0, 8000) },
          contentType: 'json'
        };
      }

      case 'text-full': {
        const fullText = await page.evaluate(() => document.body.innerText);
        return { success: true, data: { text: fullText }, contentType: 'json' };
      }

      case 'html': {
        const html = await page.content();
        return { success: true, data: html.substring(0, 10000), contentType: 'html' };
      }

      case 'html-full': {
        const fullHtml = await page.content();
        return { success: true, data: fullHtml, contentType: 'html' };
      }

      case 'links': {
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]')).map(a => ({
            text: (a as HTMLAnchorElement).innerText?.trim().substring(0, 100),
            href: (a as HTMLAnchorElement).href,
            isVisible: (a as HTMLElement).offsetParent !== null
          }));
        });
        return {
          success: true,
          data: { count: links.length, links: links.filter(l => l.isVisible).slice(0, 50) },
          contentType: 'json'
        };
      }

      case 'buttons': {
        const buttons = await page.evaluate(() => {
          const els = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
          return Array.from(els).map(b => ({
            tagName: b.tagName.toLowerCase(),
            text: (b as HTMLElement).innerText?.trim() || (b as HTMLInputElement).value || '',
            type: (b as HTMLButtonElement).type || null,
            disabled: (b as HTMLButtonElement).disabled,
            isVisible: (b as HTMLElement).offsetParent !== null
          }));
        });
        return { success: true, data: buttons, contentType: 'json' };
      }

      case 'inputs': {
        const inputs = await page.evaluate(() => {
          const els = document.querySelectorAll('input, textarea, select');
          return Array.from(els).map(i => ({
            tagName: i.tagName.toLowerCase(),
            type: (i as HTMLInputElement).type || null,
            name: (i as HTMLInputElement).name || null,
            id: i.id || null,
            placeholder: (i as HTMLInputElement).placeholder || null,
            value: (i as HTMLInputElement).value || null,
            required: (i as HTMLInputElement).required,
            disabled: (i as HTMLInputElement).disabled,
            isVisible: (i as HTMLElement).offsetParent !== null
          }));
        });
        return { success: true, data: inputs, contentType: 'json' };
      }

      case 'forms': {
        const forms = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('form')).map(f => ({
            id: f.id || null,
            action: f.action || null,
            method: f.method || 'get',
            inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(i => ({
              tagName: i.tagName.toLowerCase(),
              type: (i as HTMLInputElement).type,
              name: (i as HTMLInputElement).name,
              id: i.id,
              required: (i as HTMLInputElement).required
            }))
          }));
        });
        return { success: true, data: forms, contentType: 'json' };
      }

      case 'interactive': {
        const elements = await page.evaluate(() => {
          const els = document.querySelectorAll(
            'a, button, input, textarea, select, [onclick], [role="button"], [role="link"], [tabindex]'
          );
          return Array.from(els)
            .filter(el => (el as HTMLElement).offsetParent !== null)
            .map((el, index) => {
              const rect = el.getBoundingClientRect();
              return {
                index,
                tagName: el.tagName.toLowerCase(),
                type: (el as HTMLInputElement).type || el.getAttribute('role') || null,
                id: el.id || null,
                text: ((el as HTMLElement).innerText || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || '').substring(0, 100).trim(),
                href: (el as HTMLAnchorElement).href || null,
                selector: el.id ? `#${el.id}` :
                  el.className ? `.${el.className.split(' ')[0]}` :
                    `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`,
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              };
            });
        });
        return {
          success: true,
          data: { count: elements.length, elements: elements.slice(0, 75) },
          contentType: 'json'
        };
      }

      case 'screenshot': {
        const fullPage = args.includes('--full');
        const buffer = await page.screenshot({ fullPage, encoding: 'binary' }) as Buffer;
        return { success: true, contentType: 'image', binary: buffer };
      }

      case 'cookies': {
        const cookies = await page.cookies();
        return { success: true, data: cookies, contentType: 'json' };
      }

      // Evaluate
      case 'eval': {
        const code = args.join(' ');
        const result = await page.evaluate(code);
        return { success: true, data: { result }, contentType: 'json' };
      }

      // Tab management
      case 'tabs': {
        const pages = await browser.pages();
        const tabs = await Promise.all(pages.map(async (p, i) => ({
          index: i,
          url: p.url(),
          title: await p.title().catch(() => ''),
          isActive: p === page
        })));
        return { success: true, data: { count: pages.length, tabs }, contentType: 'json' };
      }

      case 'new-tab': {
        const newPage = await browser.newPage();
        return { success: true, data: { message: 'New tab created', url: newPage.url() }, contentType: 'json' };
      }

      case 'switch-tab': {
        const pages = await browser.pages();
        const idx = parseInt(args[0]);
        if (idx >= 0 && idx < pages.length) {
          await pages[idx].bringToFront();
          return { success: true, data: { url: pages[idx].url() }, contentType: 'json' };
        }
        return { success: false, error: `Invalid tab index: ${idx}`, contentType: 'json' };
      }

      case 'close-tab': {
        const pages = await browser.pages();
        const idx = parseInt(args[0]);
        if (idx >= 0 && idx < pages.length) {
          if (pages[idx] === page) {
            return { success: false, error: 'Cannot close active tab', contentType: 'json' };
          }
          await pages[idx].close();
          return { success: true, data: { message: `Closed tab ${idx}` }, contentType: 'json' };
        }
        return { success: false, error: `Invalid tab index: ${idx}`, contentType: 'json' };
      }

      case 'close-other-tabs': {
        const pages = await browser.pages();
        let closed = 0;
        for (const p of pages) {
          if (p !== page) {
            await p.close().catch(() => {});
            closed++;
          }
        }
        return { success: true, data: { closed }, contentType: 'json' };
      }

      default:
        return { success: false, error: `Unknown command: ${cmd}`, contentType: 'json' };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      contentType: 'json'
    };
  }
}

async function waitForSettle(page: Page, timeout = 2000): Promise<void> {
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
      new Promise(r => setTimeout(r, timeout))
    ]);
  } catch {
    // Ignore timeout errors
  }
}
