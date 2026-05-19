# Vault Clone

An Obsidian plugin that creates a new vault by cloning the configuration of an existing one.

Pick a source vault, choose what to inherit (theme, hotkeys, plugins, etc.), name your new vault, and you're done.

## Features

- Create a new vault from any known local Obsidian vault.
- Selectively copy configuration by category — no need to understand individual `.obsidian` files.
- **Appearance**: theme, downloaded themes, fonts, accent color, CSS snippets.
- **Behavior**: hotkeys, editor preferences, links, attachments, daily notes, templates, graph settings.
- **Plugins**: community plugin list, core plugin toggles, and plugin-specific config.
- Automatically opens the newly created vault.
- Bilingual UI (English / 中文).

## How It Works

1. Open any existing vault in Obsidian.
2. Click the **Vault Clone** ribbon icon (or use the command palette).
3. Choose the source vault you want to clone from.
4. Select which configuration groups to inherit.
5. Enter the new vault name and save location.
6. Click **Create vault**.

The plugin creates the target folder, copies the selected `.obsidian` settings, registers the new vault with Obsidian, and opens it.

## Limitations

- Desktop only — the plugin creates folders and copies local files.
- Must be launched from an already-opened vault (Obsidian limitation).
- Does not replace Obsidian's native startup create-vault screen.
- Source vault must have a valid `.obsidian` folder.

## Installation

### From Obsidian Community Plugins (coming soon)

Search for **Vault Clone** in Settings → Community Plugins → Browse.

### Manual

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/Ezra-Y/obsidian-vault-clone/releases/latest).
2. Create a folder `.obsidian/plugins/vault-clone/` in any vault.
3. Place both files inside that folder.
4. Enable **Vault Clone** in Settings → Community Plugins.

## Development

```bash
npm install
npm run build
```

Copy `manifest.json` and `main.js` into `.obsidian/plugins/vault-clone/` for local testing.

## License

MIT
