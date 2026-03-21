# Keymap Highlight

Keymap Highlight is a web-based visualization tool for inspecting keymap configurations in your editor and software.

## Current Feature Status

These tables describe the current shipped app status in this repository.

- `✅ Ready`
- `⚠️ Partial / Experimental`
- `⏳ Not yet implemented`

### Editor and Software Support

| Editor / Software    | Keymap Parser | Demo Presets |
| -------------------- | ------------- | ------------ |
| VS Code              | ✅            | ✅           |
| JetBrains IDEs       | ✅            | ⚠️           |
| Vim                  | ⚠️            | ⚠️           |
| Neovim               | ⚠️            | ⏳           |
| Zed                  | ✅            | ✅           |
| Krita                | ✅            | ✅           |
| Adobe Illustrator    | ✅            | ✅           |
| Blender              | ✅            | ✅           |
| GNU nano             | ✅            | ✅           |
| Emacs                | ⚠️            | ⏳           |
| Adobe Photoshop      | ⏳            | ⏳           |
| Adobe After Effects  | ⏳            | ⏳           |
| Adobe Lightroom      | ⏳            | ⏳           |
| Autodesk Maya        | ⏳            | ⏳           |
| Sublime Text         | ⏳            | ⏳           |
| Chrome               | ⏳            | ⏳           |
| Microsoft Word       | ⏳            | ⏳           |
| Microsoft Excel      | ⏳            | ⏳           |
| Microsoft PowerPoint | ⏳            | ⏳           |

### Functionality Status

| Area                                                            | Status |
| --------------------------------------------------------------- | ------ |
| Privacy-first local processing and persistence                  | ✅     |
| Keyboard visualization                                          | ✅     |
| Key bindings searching, grouping, filtering                     | ✅     |
| Context of action analysis                                      | ✅     |
| Keyboard hardware/input layout switching                        | ✅     |
| Human-friendly action labels                                    | ✅     |
| Cheatsheet export (PDF/Markdown)                                | ✅     |
| UI/UX i18n                                                      | ⚠️     |
| Code Test Suites                                                | ⚠️     |
| In-app usage guide and help                                     | ⏳     |
| Press keys on physical keyboard to retrieve associated bindings | ⏳     |

## Getting Started

This project is structured as a monorepo.

### Local Development

#### Prerequisites

- [Node.js](https://nodejs.org/) (v21 or higher recommended)
- [pnpm](https://pnpm.io/) (or other package managers you prefer to try)

#### Setup Instructions

1. **Clone the repository to your preferred directory:**

   ```bash
   git clone https://github.com/your-username/keymap-highlight.git
   cd keymap-highlight
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Start the development server:**

   ```bash
   pnpm dev
   ```

   This will spin up the Vite dev server for the web app and watch for changes in the parser packages simultaneously.

   Alternatively, if you want the application to open in your browser immediately, add the `--open` flag.

   ```bash
   pnpm dev --open
   ```

4. **Build for production:**
   ```bash
   pnpm build
   ```
   The built static files will be located in `apps/web/dist/`. You can serve this directory using any static web server (e.g., Nginx, Caddy, Vercel, or standard static hosting).

#### Additional Commands

- Run linters: `pnpm lint`
- Run tests: `pnpm test`

### Deploy to Cloudflare

#### Prerequisites

A Cloudflare account and your Keymap Highlight repository.

#### Setup Instructions

1. Open **Cloudflare Dashboard -> Workers & Pages -> Create application**.
2. Connect with a Git provider (GitHub or GitLab), then select your forked Keymap Highlight repository.
3. In the project setup form, use these values:
   - **Project name:** Your preferred name
   - **Build command:** `pnpm run build`
   - **Deploy command:** `pnpm run deploy`
   - **Path:** `/`

4. Click **Deploy**, then wait for the deployment to complete. Cloudflare will monitor the repository for changes and automatically deploy updates.

## Tech Stack

- **Framework:** React + Vite (Static-ready SPA)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Chakra UI
- **State Management:** Zustand (LocalStorage)
- **Rendering:** Konva.js (Keyboard Canvas)
- **Internationalization:** i18next

## License

See the [LICENSE](./LICENSE) file.
