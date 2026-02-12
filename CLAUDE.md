# ghast-ctl - Browser/Electron Automation

You are a browser automation agent. Control browsers and Electron apps via CDP with stealth capabilities.

## Quick Start

```bash
# Start browser daemon (outputs port to stdout)
PORT=$(node dist/cli.js start 2>/dev/null &); sleep 3

# Send commands
node dist/cli.js control --server $PORT "navigate https://example.com"
node dist/cli.js control --server $PORT "wait 2000"
node dist/cli.js control --server $PORT "text"
node dist/cli.js control --server $PORT "screenshot" > screenshot.png

# Stop when done
node dist/cli.js stop --server $PORT
```

With stealth mode:
```bash
PORT=$(node dist/cli.js start --stealth 2>/dev/null &); sleep 3
```

Connect to existing Chrome (launched with `--remote-debugging-port=9222`):
```bash
PORT=$(node dist/cli.js start --port 9222 2>/dev/null &); sleep 2
```

Launch Electron app:
```bash
PORT=$(node dist/cli.js start --electronApp /Applications/Slack.app 2>/dev/null &); sleep 5
```

---

## Commands Reference

### Navigation
```bash
node dist/cli.js control --server $PORT "navigate <url>"
node dist/cli.js control --server $PORT "navigate-force <url> [timeout_ms]"
node dist/cli.js control --server $PORT "back"
node dist/cli.js control --server $PORT "forward"
node dist/cli.js control --server $PORT "refresh"
```

**Note:** Use `navigate-force` for JS-heavy sites that never fully settle.

### Reading Page State
```bash
node dist/cli.js control --server $PORT "info"           # URL, title (JSON)
node dist/cli.js control --server $PORT "text"           # Visible text truncated (JSON)
node dist/cli.js control --server $PORT "text-full"      # All visible text (JSON)
node dist/cli.js control --server $PORT "html"           # HTML truncated (text/html)
node dist/cli.js control --server $PORT "html-full"      # Full HTML (text/html)
node dist/cli.js control --server $PORT "links"          # All links (JSON)
node dist/cli.js control --server $PORT "buttons"        # All buttons (JSON)
node dist/cli.js control --server $PORT "inputs"         # All form inputs (JSON)
node dist/cli.js control --server $PORT "forms"          # Form structures (JSON)
node dist/cli.js control --server $PORT "interactive"    # All clickable elements (JSON)
node dist/cli.js control --server $PORT "screenshot"     # PNG to stdout
node dist/cli.js control --server $PORT "screenshot --full"  # Full page PNG
node dist/cli.js control --server $PORT "cookies"        # Cookies (JSON)
```

### Interacting with Elements
```bash
node dist/cli.js control --server $PORT "click <selector>"
node dist/cli.js control --server $PORT "type <selector> <text>"
node dist/cli.js control --server $PORT "clear-and-type <selector> <text>"
node dist/cli.js control --server $PORT "press <key>"                    # Enter, Tab, Escape, etc.
node dist/cli.js control --server $PORT "select <selector> <value>"
node dist/cli.js control --server $PORT "hover <selector>"
node dist/cli.js control --server $PORT "scroll down 500"
node dist/cli.js control --server $PORT "scroll up 500"
node dist/cli.js control --server $PORT "scroll to <selector>"
node dist/cli.js control --server $PORT "scroll bottom"
node dist/cli.js control --server $PORT "scroll top"
```

### Waiting
```bash
node dist/cli.js control --server $PORT "wait 2000"
node dist/cli.js control --server $PORT "wait-for <selector>"
```

### JavaScript Evaluation
```bash
node dist/cli.js control --server $PORT "eval document.querySelector('h1').textContent"
node dist/cli.js control --server $PORT "eval Array.from(document.querySelectorAll('a')).map(a => a.href)"
```

### Tab Management
```bash
node dist/cli.js control --server $PORT "tabs"
node dist/cli.js control --server $PORT "new-tab"
node dist/cli.js control --server $PORT "switch-tab <index>"
node dist/cli.js control --server $PORT "close-tab <index>"
node dist/cli.js control --server $PORT "close-other-tabs"
```

### History
```bash
curl http://localhost:$PORT/history
```

Returns timeline of all commands with urlBefore, urlAfter, result, success.

---

## Response Types

| Command | Content-Type | Output |
|---------|--------------|--------|
| screenshot | image/png | Binary PNG to stdout |
| html, html-full | text/html | HTML to stdout |
| Everything else | application/json | JSON to stdout |

---

## Exit Codes

- `0` - Command succeeded (2xx response)
- `1` - Command failed (non-2xx response)

---

## Best Practices

### Act Human
- Add `wait 2000-3000` between actions
- Don't spam requests
- Scroll before clicking elements below the fold

### Finding Elements
If you don't know the selector:
1. `interactive` - lists all clickable elements with suggested selectors
2. `links` - find navigation links
3. `buttons` - find all buttons
4. `inputs` - find form fields
5. `eval` with querySelectorAll to explore

### Verify Navigation
```bash
node dist/cli.js control --server $PORT "navigate https://example.com"
node dist/cli.js control --server $PORT "wait 2000"
node dist/cli.js control --server $PORT "info"
```

---

## Stealth Features

When `--stealth` is enabled (fresh browser only):
- puppeteer-extra with stealth plugin
- webdriver property removal
- Chrome plugin mocking
- Navigator property spoofing
- Screen dimension spoofing
- WebGL vendor spoofing
- Realistic user agent
- Automation flags disabled

For Electron/existing CDP connections, JS evasions are still injected but stealth plugin unavailable.

---

## Knowledge Files

After completing a browser task, ask the user if they want to save a knowledge file. These go in `knowledge/<website>.md` (e.g., `knowledge/reddit.md`, `knowledge/robinhood.md`).

**The golden rule:** Knowledge files teach how to drive the car, not where to go or why.

### What BELONGS in a knowledge file:
- Navigation patterns (how to get to different sections)
- Useful selectors for common elements
- How dynamic content loads (infinite scroll, lazy loading, modals)
- Quirks and gotchas (cookie banners, required waits, flaky elements)
- Login flow structure (not credentials)

### What does NOT belong:
- Task-specific logic or decisions
- What data to extract or analyze
- Business logic or strategy
- Specific values, tickers, search terms, etc.

### Examples

**Task:** "Go to r/wallstreetbets and analyze ticker sentiment"

**knowledge/reddit.md should contain:**
```markdown
## Navigation
- Subreddit URL pattern: `reddit.com/r/<subreddit>`
- Posts are in `[data-testid="post-container"]`
- Infinite scroll - use `scroll bottom` and `wait 2000` to load more

## Selectors
- Post title: `[data-testid="post-title"]`
- Post body: `[data-testid="post-body"]`
- Comments: `.Comment`
- Upvote count: `[data-testid="score"]`

## Gotchas
- Cookie banner appears on first visit, dismiss with `click [accept-cookies-selector]`
- NSFW subreddits require clicking through a gate
```

**Should NOT contain:** How to identify tickers, what sentiment analysis to perform, which posts matter.

---

**Task:** "Go to an e-commerce site and add items to cart"

**knowledge/shop-example.md should contain:**
```markdown
## Navigation
- Search: Input field in header, usually `input[type="search"]` or `#search`
- Categories: Navigation menu, hover to reveal dropdowns
- Product page: Click product card from listing

## Add to Cart Flow
- Size/variant selector: Usually radio buttons or dropdown
- Quantity: Input or +/- buttons
- Add button: `[data-testid="add-to-cart"]` or `.add-to-cart-btn`

## Selectors
- Product cards: `.product-card` or `[data-testid="product"]`
- Price: `.price` or `[data-testid="price"]`
- Cart icon: `.cart-icon` or header cart link
- Checkout button: Usually prominent button in cart

## Gotchas
- Size must be selected before add-to-cart is clickable
- Cart drawer may animate in - wait for it
- Some sites require cookie consent before interaction
```

**Should NOT contain:** What to buy, price thresholds, checkout decisions, payment info.

---

### Workflow

1. Complete the user's browser task
2. Ask: "Want me to save navigation hints to `knowledge/<site>.md`?"
3. If yes, extract only reusable navigation knowledge
4. Check if file exists - if so, merge new learnings with existing content
