# commits.sh — macOS menu-bar app

Streams your local **ccusage** stats (tokens, value extracted, leverage) to your
[commits.sh](https://commits.sh) ticker, live, every 60 seconds. Menu-bar only —
no dock icon, no window in your way.

## Build & run

```bash
cd mac
./build-app.sh          # release build → dist/commits.sh.app
open dist/commits.sh.app # icon appears in your menu bar
```

Or during development:

```bash
swift run
```

Requires macOS 13+, Swift 6 (Xcode 16+), and Node/`npx` on your PATH (for
`ccusage`). Reads ccusage via a login shell so it finds your Node install.

## How it works

1. Click the menu-bar icon → **Connect with GitHub**.
2. Your browser opens `commits.sh/connect?code=…`; approve the device once
   (you must have claimed your ticker — that's what proves it's you).
3. The app pairs, stores a scoped device token, and streams `ccusage --json`
   totals to `commits.sh/api/ingest` every 60 seconds.
4. Your `/live` page and profile show live tokens · value · leverage.

It sends **only counts & costs** — never paths, prompts, or arguments. The
device token can only write to *your* verified ticker.

## Architecture

| file | role |
|------|------|
| `main.swift` | app entry; menu-bar-only via `.accessory` activation policy |
| `AppDelegate.swift` | `NSStatusItem` + SwiftUI popover |
| `ConnectionManager.swift` | pairing, token storage, 60s stream loop, state |
| `Ccusage.swift` | runs `ccusage --json` through a login shell, parses totals |
| `API.swift` | `/api/connect/pair`, `/api/ingest` |
| `MenuView.swift` | SwiftUI popover UI (brand-matched: dark, green `.sh`, mono) |

## Distribution

`build-app.sh` ad-hoc-signs the bundle so it runs locally. To ship it to other
people without Gatekeeper warnings you need an **Apple Developer account** ($99/yr):
sign with a Developer ID certificate and notarize (`xcrun notarytool submit`),
then staple. Until then, users can right-click → Open to bypass Gatekeeper.
