# HoYo Gacha History Exporter (`hoyo-gacha-export`)

[简体中文](../README.md) | English

A unified 4-in-1 desktop gacha history exporter built with Electron + Vue 3 for **Genshin Impact**, **Honkai: Star Rail**, **Zenless Zone Zero**, and **Miliastra Wonderland** (Genshin Impact UGC Beyond Odes). It extracts the official gacha history `authkey` URL from game logs, web caches, or a local MITM proxy, merges incremental pulls locally, and exports to styled Excel workbooks or cross-game UIGF v4.2 JSON.

## Supported Games & Banners

| Game | Log / Cache Source | Supported Banners | Highlights |
| --- | --- | --- | --- |
| **Genshin Impact** (`hk4e`) | `output_log.txt` / `MiHoYoSDK.log` | Character Event (incl. banner `400` merged under `301`), Weapon Event, Chronicled Wish (`500`), Standard, Novice | Cloud Genshin (`zh-cn`), UIGF v3.0 & v4.2, cached `item_id` dictionary |
| **Honkai: Star Rail** (`hkrpg`) | `Player.log` (CN / Global) | Character & Light Cone Warps, Collaboration Warps (`21`/`22`), Stellar, Departure | SRGF v1.0 import support, bundled `idJson.json` |
| **Zenless Zone Zero** (`nap`) | `Player.log` + `ZenlessZoneZero_Data` | Exclusive & W-Engine Channels (incl. Rerun channels `102`/`103`), Bangboo (`5`), Stable | S/A/B rank & Bangboo breakdowns, automatic timezone alignment |
| **Miliastra Wonderland** (`hk4e_ugc`) | `output_log.txt` / `MiHoYoSDK.log` | Event Ode (`2000`, merging sub-pools `20011`–`20022`), Standard Ode (`1000`) | Standard wish `authkey` fallback & UID probe, UIGF v4.2 (`hk4e_ugc`), 4★ Standard pity & 2★–5★ charts |

## Features

- **Unified 4-Tab Workspace**: Switch seamlessly between Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, and Miliastra Wonderland from the top bar with isolated per-tab settings, `authkey` URL cache, and UID selections.
- **Isolated Storage & Legacy Migration**: Stores records under `userData/{genshin,starrail,zzz,beyond}/` and automatically migrates legacy root-level `gacha-list-*.json` and single-game `config.json` files on startup.
- **Miliastra Wonderland Adapter**:
  - Queries `getBeyondGachaLog` (`size=5`, normalizing `lang` to full UIGF locales such as `en-us`/`ja-jp`/`zh-cn`), intercepts `gs.hoyoverse.com` (`e20250716gacha`) alongside CN `webstatic` domains, falls back to standard Genshin wish webview URLs if needed, and probes standard `getGachaLog` when `list[].uid` is empty.
  - **Event Ode (`2000`)** tracks 5★ pity while annotating `20011`/`20012`/`20021`/`20022` sub-banners in tooltips and the Excel Remark column; **Standard Ode (`1000`)** tracks 4★ pity across 4★/3★/2★ cosmetics.
- **Excel & Cross-Game UIGF v4.2**:
  - Export **Excel (`.xlsx`)**: One sheet per banner plus a `rawData` sheet, complete with pull counts, pity tracking, sub-banner remarks, and rank color styling.
  - Export **UIGF v4.2**: Pick any combination of accounts across `hk4e`, `hkrpg`, `nap`, and `hk4e_ugc` in one dialog and export a combined UIGF v4.2 JSON (with Genshin UIGF v3.0 export still available).
  - Import support: **UIGF v4.0 / v4.1 / v4.2** (all 4 modules at once), **UIGF v3.0**, **SRGF v1.0**, and legacy `gacha-list-*.json` backups.

## Usage

1. Download and extract the latest archive from [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases) (or build from source).
2. Open the in-game **Wish / Warp / Signal Search / Miliastra Wonderland Ode History** page so the client writes a fresh link to its local log/cache.
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

This repository merges and adapts the work of open-source MIT projects into a single application, preserving all original copyright notices:

- **[@biuuu](https://github.com/biuuu) — [`biuuu/genshin-wish-export`](https://github.com/biuuu/genshin-wish-export)** (`MIT License, Copyright (c) 2021 biuuu`)
  - Base Electron + Vue 3 + Tailwind architecture, Genshin Impact wish adapter, proxy interception, UIGF schema validation, and item ID lookup.
- **[@biuuu](https://github.com/biuuu) — [`biuuu/star-rail-warp-export`](https://github.com/biuuu/star-rail-warp-export)** (`MIT License, Copyright (c) 2023 biuuu`)
  - Honkai: Star Rail warp adapter (including collab warps `21`/`22`), SRGF support, and `idJson.json` generation script.
- **[@earthjasonlin](https://github.com/earthjasonlin) — [`earthjasonlin/zzz-signal-search-export`](https://github.com/earthjasonlin/zzz-signal-search-export)** (`MIT License, Copyright (c) 2024 earthjasonlin`)
  - Zenless Zone Zero signal search adapter (`real_gacha_type`, rerun pools `102`/`103`, Bangboo channel `5`), S/A/B rank visualization, server timezone normalization, and `idJson.json`.
- **[@Scighost](https://github.com/Scighost) — [`Scighost/Starward`](https://github.com/Scighost/Starward)** (`MIT License`)
  - Reference for Miliastra Wonderland (`getBeyondGachaLog`, `size=5`, full language codes, `gs.hoyoverse.com` cache pattern) and UIGF v4.2 (`hk4e_ugc`) compliance.
- **[@GoneTone](https://github.com/GoneTone) — [`GoneTone/genshin-impact-wish-gacha-analyzer`](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer)** (`MIT License`)
  - Reference for Ode pity mechanics, sub-pool breakdowns, and UID probing behavior.
- **[@sunfkny](https://github.com/sunfkny) — [`sunfkny/genshin-gacha-export-js`](https://github.com/sunfkny/genshin-gacha-export-js)**
  - Inspiration for ExcelJS export structure and styling.
- **[UIGF-org](https://uigf.org/)**
  - Unified Interchangeable GachaLog Format specification (`v3.0`–`v4.2`) and Genshin item dictionary API.

## License

[MIT](../LICENSE)
