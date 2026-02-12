# ghast

puppeteer but it can also connect to stuff thats already running. electron apps, chrome with debugging enabled, whatever.

runs an express server so you can send commands from anywhere. port gets printed to stdout.

## install

```bash
npm install
npm run build
```

## install cli command
bash```
npm install-global
```
```
## usage

```bash
# start a browser
PORT=$(./ghast start)

# do stuff
./ghast control --server $PORT "navigate https://example.com"
./ghast control --server $PORT "screenshot" > shot.png
./ghast control --server $PORT "text"

# done
./ghast stop --server $PORT
```

### connect to existing chrome

start chrome with `--remote-debugging-port=9222` then:

```bash
PORT=$(./ghast start --port 9222)
```

### connect to electron app

```bash
PORT=$(./ghast start --electronApp /Applications/Slack.app)
```

this kills the app, relaunches it with debugging enabled, and connects. if you just want to connect to an electron app thats already running with CDP, use `--port` instead.

### stealth mode

```bash
PORT=$(./ghast start --stealth)
```

uses puppeteer-extra stealth plugin + some extra js evasions. only works fully when launching a fresh browser. connecting to existing stuff still injects the js bits but cant use the plugin.

### agent mode

starts a browser and drops you into claude with the browser already connected:

```bash
./ghast agent "go to hackernews and get the top 5 stories"
./ghast agent --stealth knowledge/reddit.md "analyze sentiment on r/wallstreetbets"
```

knowledge files are optional - they teach claude how to navigate specific sites.

## commands

**navigation:** `navigate <url>`, `navigate-force <url>`, `back`, `forward`, `refresh`

**reading:** `info`, `text`, `text-full`, `html`, `html-full`, `links`, `buttons`, `inputs`, `forms`, `interactive`, `screenshot`, `cookies`

**interaction:** `click <sel>`, `type <sel> <text>`, `clear-and-type <sel> <text>`, `press <key>`, `select <sel> <val>`, `hover <sel>`, `scroll down|up|top|bottom|to <sel>`

**waiting:** `wait <ms>`, `wait-for <selector>`

**tabs:** `tabs`, `new-tab`, `switch-tab <i>`, `close-tab <i>`, `close-other-tabs`

**eval:** `eval <javascript>` - run arbitrary js in the page

## responses

- most commands return json
- `screenshot` returns png binary
- `html` and `html-full` return text/html
- non-2xx status = command failed, exit code 1

## license

MIT
