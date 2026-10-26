# Sharp Volta ⚡

An ultra-fast, zero-dependency Mattermost desktop client built with **Bun**, **TypeScript (`jsx-dom`)**, and **Tailwind CSS v4**.

Designed for speed, low memory footprint, and modern workflows with native session synchronization and LLM-assisted productivity features.

---

## ✨ Features

- **⚡ Zero-Virtual-DOM Architecture**: Functional TSX components compiling directly to native DOM elements via `jsx-dom` with zero diffing overhead.
- **🔄 macOS Session Sync**: Directly decrypts and syncs active Mattermost macOS Desktop sessions from Safe Storage Keychain and Cookies SQLite database.
- **💬 Real-Time Gateway**: Live WebSocket pub/sub for new posts, edits, streaming bot updates, status indicators, and typing events.
- **📎 File & Image Uploads**: Paperclip attachment button and drag-and-drop upload zone with preview thumbnails before sending.
- **🤖 Extract Chat for LLMs**: 1-click export of loaded chat transcripts with clickable media links and structured prompts for Todo list generation, action items, and task tracking.
- **📂 Collapsible Channel Sidebar**: Collapsible navigation with keyboard shortcut (`⌘B`), instant filter (`⌘K`), and state persistence.
- **🔔 Notifications & Audio Synthesis**: Browser desktop notifications and Web Audio API synthesized chimes for mentions and incoming messages.
- **🎨 Tailwind CSS v4 Engine**: Built-in CSS compilation using native `@tailwindcss/cli` and modern color utilities.
- **📦 Self-Contained Engine**: Zero npm Vite, Webpack, or Rollup dependencies — powered entirely by `Bun.build` and `Bun.serve`.
- **🔌 Standalone Production Output**: Compiles into `dist/server.js` and `dist/browser/` with auto-port collision resolution.

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.2 or higher)
- macOS with Mattermost Desktop app installed (for automatic session decryption), or a Mattermost server URL with credentials.

### Installation
```bash
bun install
```

### Development Mode
Run the backend server and frontend dev server with instant HMR:
```bash
# Terminal 1: Backend API & WebSocket server
bun run server

# Terminal 2: BunVite frontend dev server (with HMR)
bun run dev
```

Visit `http://localhost:5173` in your browser.

### Production Build & Run
```bash
# Compile standalone server and optimized browser assets
bun run build

# Start the production server
bun run start
```

Visit `http://localhost:3000` (or the automatically selected available port).

---

## ⚙️ Configuration

Copy `.env.example` to `.env` to customize settings:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `VITE_APP_TITLE` | `Sharp Volta (Mattermost)` | Application title displayed in browser tab and UI |
| `VITE_PROXY_TARGET` | `http://localhost:3000` | Backend API target for development proxy |
| `VITE_WS_TARGET` | `ws://localhost:3000/ws` | WebSocket gateway URL for development proxy |
| `MATTERMOST_URL` | Auto-detected | Base URL of your Mattermost instance (e.g. `https://mattermost.example.com`) |
| `MATTERMOST_HOST_FILTER` | `%` | Cookie host filter if multiple Mattermost workspaces exist |
| `MATTERMOST_KEYCHAIN_PASSWORD` | Auto-read | Safe Storage password (retrieved from macOS Keychain by default) |
| `PORT` | `3000` | Server port (automatically increments if port is in use) |

---

## 🧪 Testing & Verification

The project includes unit and integration tests across dev server, app lifecycle, virtual list, file upload, notifications, and LLM chat extractor:

```bash
# Run all tests
bun test

# Run typecheck and Biome linter
bun run typecheck
bun run lint

# Run complete quality check
bun run check
```

---

## 📁 Project Structure

```
├── public/                 # Static public assets (favicon.svg, favicon.ico, robots.txt)
├── server/                 # Standalone Bun backend server
│   ├── api.ts              # Typed Mattermost REST client
│   ├── index.ts            # Bun.serve HTTP & WebSocket server with static asset hosting
│   ├── session.ts          # Safe Storage Keychain reader & SQLite cookie decryptor
│   ├── types.ts            # Server session & message types
│   └── websocket.ts        # Mattermost WebSocket gateway client
├── src/                    # Frontend client application (jsx-dom)
│   ├── app.tsx             # Main application orchestrator & WebSocket handler
│   ├── components/         # Functional TSX components
│   │   ├── chat-header.tsx # Header with sidebar toggle, extract modal, and notification mute
│   │   ├── extract-modal.tsx # LLM chat transcript export modal
│   │   ├── icons.tsx       # Lightweight SVG icons
│   │   ├── message-input.tsx # Rich input with file drag-and-drop
│   │   ├── message-item.tsx  # Message item with formatting and attachments
│   │   ├── message-list.tsx  # Message feed with auto-scroll and retry
│   │   └── sidebar.tsx     # Channel list with search and collapse support
│   ├── services/           # Browser notifications and Web Audio services
│   ├── style.css           # Tailwind CSS v4 entrypoint
│   ├── types.ts            # App & Mattermost data interfaces
│   └── utils/              # Chat extractor and virtual window utilities
├── test/                   # Comprehensive Bun test suites
├── index.html              # HTML entrypoint with %VITE_*% substitution
├── package.json            # Scripts & project metadata
├── tsconfig.json           # TypeScript configuration with jsx-dom JSX source
└── vite.ts                 # Self-contained zero-dependency BunVite engine
```

---

## 📄 License

MIT © [Nicat Bayramov](https://github.com/BayramovNicat)
