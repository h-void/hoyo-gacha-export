# HoYo Gacha History Exporter (`hoyo-gacha-export`)

[简体中文](../README.md) | English

A unified 4-in-1 desktop gacha history exporter built with Electron + Vue 3 for **Genshin Impact**, **Honkai: Star Rail**, **Zenless Zone Zero**, and **Miliastra Wonderland**. It reads game logs or intercepts via a local proxy to fetch your history URL, merges incremental records locally, and exports to Excel or UIGF JSON.

## Features

- **4-in-1 Workspace**: Switch between Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, and Miliastra Wonderland from the top bar with isolated per-game storage (plus automatic migration from legacy single-game data).
- **Flexible Import & Export**:
  - **Excel (`.xlsx`)**: One sheet per banner plus a `rawData` sheet with pity counts and rank styling.
  - **UIGF v4.2 / v3.0**: Combine multiple UIDs across all 4 games into a single UIGF v4.2 JSON export.
  - **Import**: Supports **UIGF v4.0–v4.2**, **UIGF v3.0**, **SRGF v1.0**, and legacy `gacha-list-*.json` files.

## Usage

1. Download and extract the latest build from [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases).
2. Open the in-game **Wish / Warp / Signal Search / Miliastra Wonderland Ode History** page.
3. Select the game tab at the top and click **Load data**:

   ![Load data](./load-data.png)

   If local log detection cannot find the link, enable proxy mode in **Options** (top right) and reopen the in-game history page.
4. Once loaded, click **Import / Export** to export your data. To add another account/UID, click the `+` button next to the UID selector, switch accounts in-game, open the history page, and click **Load data** again.

## Development

Requires Node.js (>= 22 LTS) and Yarn:

```bash
yarn install        # Install dependencies
yarn dev            # Run in dev mode
yarn test           # Run unit tests
yarn build:app      # Compile Electron main + renderer bundles
yarn build:win64    # Package distributables (also build:win32 / build:linux / build:mac)
```

<details>
<summary>Refresh bundled Star Rail & ZZZ item ID maps</summary>

Requires Python 3 (`requests`, `opencc`):

```bash
python tools/getIdMap.py --game all
```

</details>

## Credits & Upstream Attribution

This project builds upon the following open-source projects, preserving all original copyright notices:

- **[@biuuu](https://github.com/biuuu)** — [`genshin-wish-export`](https://github.com/biuuu/genshin-wish-export) (`MIT License, Copyright (c) 2021 biuuu`), [`star-rail-warp-export`](https://github.com/biuuu/star-rail-warp-export) (`MIT License, Copyright (c) 2023 biuuu`)
- **[@earthjasonlin](https://github.com/earthjasonlin)** — [`zzz-signal-search-export`](https://github.com/earthjasonlin/zzz-signal-search-export) (`MIT License, Copyright (c) 2024 earthjasonlin`)
- **[@Scighost](https://github.com/Scighost)** — [`Starward`](https://github.com/Scighost/Starward) (`MIT License`)
- **[@GoneTone](https://github.com/GoneTone)** — [`genshin-impact-wish-gacha-analyzer`](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer) (`MIT License`)
- **[@sunfkny](https://github.com/sunfkny)** — [`genshin-gacha-export-js`](https://github.com/sunfkny/genshin-gacha-export-js)
- **[UIGF-org](https://uigf.org/)** — Unified Interchangeable GachaLog Format (`UIGF` / `SRGF`)

## License

[MIT](../LICENSE)
