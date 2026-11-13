# HoYo Gacha History Exporter (`hoyo-gacha-export`)

[简体中文](../README.md) | English

A unified 3-in-1 desktop gacha history exporter built with Electron + Vue 3 for **Genshin Impact**, **Honkai: Star Rail**, and **Zenless Zone Zero**. It extracts the official gacha history `authkey` URL from game logs, web caches, or a local MITM proxy, merges incremental pulls locally, and exports to styled Excel workbooks or cross-game UIGF JSON.

## Supported Games & Banners

| Game | Log / Cache Source | Supported Banners | Highlights |
| --- | --- | --- | --- |
| **Genshin Impact** (`hk4e`) | `output_log.txt` / `MiHoYoSDK.log` | Character Event (incl. banner `400` merged under `301`), Weapon Event, Chronicled Wish (`500`), Standard, Novice | Cloud Genshin (`zh-cn`), UIGF v3.0 & v4.1, cached `item_id` dictionary |
| **Honkai: Star Rail** (`hkrpg`) | `Player.log` (CN / Global) | Character & Light Cone Warps, Collaboration Warps (`21`/`22`), Stellar, Departure | SRGF v1.0 import support, bundled `idJson.json` |
| **Zenless Zone Zero** (`nap`) | `Player.log` + `ZenlessZoneZero_Data` | Exclusive & W-Engine Channels (incl. Rerun channels `102`/`103`), Bangboo (`5`), Stable | S/A/B rank & Bangboo breakdowns, automatic timezone alignment |

## Features

- **Unified 3-Game Workspace**: Switch seamlessly between Genshin Impact, Honkai: Star Rail, and Zenless Zone Zero from the top bar with isolated per-game settings, `authkey` URL cache, and UID selections.
- **Isolated Storage & Legacy Migration**: Stores records under `userData/{genshin,starrail,zzz}/` and automatically migrates legacy root-level `gacha-list-*.json` and single-game `config.json` files on startup.
- **Unified Data Management**: View, soft-delete, or restore local UID records for all three games inside a single table in Settings.
- **Excel & Cross-Game UIGF v4.1**:
  - Export **Excel (`.xlsx`)**: One sheet per banner plus a `rawData` sheet, complete with pull counts, pity tracking, and rank color styling.
  - Export **UIGF v4.1**: Pick any combination of accounts across `hk4e`, `hkrpg`, and `nap` in one dialog and export a combined UIGF v4.1 JSON (with Genshin UIGF v3.0 export still available).
  - Import support: **UIGF v4.0 / v4.1** (all 3 games at once), **UIGF v3.0**, **SRGF v1.0**, and legacy `gacha-list-*.json` backups.

## Usage

1. Download and extract the latest archive from [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases) (or build from source).
2. Open the in-game **Wish / Warp / Signal Search History** page so the game writes a fresh link to its local log/cache.
3. Select the game at the top of HoYo Gacha Export and click **Load data**.
4. Use the `+` button to add additional accounts/UIDs.

## Development

Requirements: Node.js (>= 22 LTS) and Yarn.

```bash
# Install dependencies
yarn install

# Run in dev mode
yarn dev

# Run unit tests
yarn test

# Compile Electron main + renderer bundles
yarn build:app

# Package distributables
yarn build:win64   # or build:win32 / build:linux / build:mac
```

To refresh the bundled Star Rail and ZZZ ID maps (requires Python 3 with `requests` and `opencc`):

```bash
python tools/getIdMap.py --game all
```

## Credits & Upstream Attribution

This repository merges and adapts the work of three open-source MIT projects into a single application, preserving all original copyright notices:

- **[@biuuu](https://github.com/biuuu) — [`biuuu/genshin-wish-export`](https://github.com/biuuu/genshin-wish-export)** (`MIT License, Copyright (c) 2021 biuuu`)
  - Base Electron + Vue 3 + Tailwind architecture, Genshin Impact wish adapter, proxy interception, UIGF schema validation, and item ID lookup.
- **[@biuuu](https://github.com/biuuu) — [`biuuu/star-rail-warp-export`](https://github.com/biuuu/star-rail-warp-export)** (`MIT License, Copyright (c) 2023 biuuu`)
  - Honkai: Star Rail warp adapter (including collab warps `21`/`22`), SRGF support, and `idJson.json` generation script.
- **[@earthjasonlin](https://github.com/earthjasonlin) — [`earthjasonlin/zzz-signal-search-export`](https://github.com/earthjasonlin/zzz-signal-search-export)** (`MIT License, Copyright (c) 2024 earthjasonlin`)
  - Zenless Zone Zero signal search adapter (`real_gacha_type`, rerun pools `102`/`103`, Bangboo channel `5`), S/A/B rank visualization, server timezone normalization, and `idJson.json`.
- **[@sunfkny](https://github.com/sunfkny) — [`sunfkny/genshin-gacha-export-js`](https://github.com/sunfkny/genshin-gacha-export-js)**
  - Inspiration for ExcelJS export structure and styling.
- **[UIGF-org](https://uigf.org/)**
  - Unified Interchangeable GachaLog Format specification and Genshin item dictionary API.

## License

[MIT](../LICENSE)
