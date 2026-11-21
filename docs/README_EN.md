# HoYo Gacha History Exporter

[中文](../README.md) | English

A unified Electron desktop tool (Windows, macOS, Linux) integrating [genshin-wish-export](https://github.com/biuuu/genshin-wish-export), [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export), and [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) across the HoYoverse game lineup.

## Support Matrix (PC Games Only, Grouped by Game → Type)

The UI uses a clean **Game → Type → Banner Filter** hierarchy focused on PC-client HoYoverse games with **zero account login / zero SToken**:

| Game | Record Type | Status | Acquisition | Export / Import |
| --- | --- | --- | --- | --- |
| **Genshin Impact** | Wish (Character / Weapon / Chronicled / Standard / Novice) | Active | Local Cache / Proxy / Manual URL / Cloud | Excel, UIGF v4.2 (`hk4e`) / v3.0, Portable JSON |
| **Genshin Impact** | Miliastra Wonderland (Event & Standard Odes) | Active | Local Cache / Proxy / Manual URL / Cloud | Excel, UIGF v4.2 (`hk4e_ugc`), Portable JSON |
| **Honkai: Star Rail** | Warp (Character / Light Cone / Collab / Standard / Starter) | Active | Local Cache / Proxy / Manual URL | Excel, UIGF v4.2 (`hkrpg`), SRGF Import, Portable JSON |
| **Honkai: Star Rail** | Interstellar Collectibles (`getBlindBoxLog`) | Active | Local Cache / Proxy / Manual URL (with Warp fallback) | Excel, Portable JSON (`hkrpg_blindbox`) |
| **Zenless Zone Zero** | Signal Search (Exclusive / W-Engine / Bangboo / Re-Screening / Standard) | Active | Local Cache / Proxy / Manual URL (2026 domains ready) | Excel, UIGF v4.2 (`nap`), Portable JSON |
| **Honkai Impact 3rd** | Supply (Battlesuit / Equipment / AstralOp / Outfit / Dorm) | Active | Official `bh3_self_help_query` + Wiki Rank (~30 days) | Excel, Portable JSON (`bh3`), HoYoGet Import |
| **Petit Planet** | Gacha | More Games (Dec 4, 2026) | Ready for live API at launch | Portable JSON (`hyg`), Excel |
| **Honkai: Nexus Anima** | Gacha | More Games (Spring 2027) | Ready for live API at launch | Portable JSON (`hna`), Excel |

The tool stores data cleanly under `userData/<id>/` and merges newly fetched records with local history.

## Usage

1. Download and unzip from [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases)
2. Open the in-game history page:
   - Genshin Impact / Miliastra Wonderland / Honkai: Star Rail / Interstellar Collectibles / ZZZ: open the in-game Wish / Ode / Warp / Collectibles / Signal Search history page
   - Honkai Impact 3rd: open **Customer Support → Self-Service Query → Supply History** (official self-service query keeps ~30 days of records; sync regularly)
3. Select the game in the top bar and click "Load data"

   ![Load data](./load-data.png)

   If the link cannot be found from logs, enable proxy mode in "Option" (top right) or paste the captured authkey URL manually.

To track multiple accounts, click the plus button, switch accounts in-game, open the history page, and click "Load data".

## Development

```bash
# install node modules
yarn install

# develop
yarn dev

# run tests
yarn test

# build a program that can run
yarn build
```

## Credits

- [@biuuu](https://github.com/biuuu) — [genshin-wish-export](https://github.com/biuuu/genshin-wish-export) / [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) (`MIT License`)
- [@earthjasonlin](https://github.com/earthjasonlin) — [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) (`MIT License`)
- [@Scighost](https://github.com/Scighost) — [Starward](https://github.com/Scighost/Starward) (`MIT License`)
- [@GoneTone](https://github.com/GoneTone) — [genshin-impact-wish-gacha-analyzer](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer) (`MIT License`)
- [@Neroliu](https://github.com/Neroliu) — [BBBUID](https://github.com/Neroliu/BBBUID) & [@YUYUYUYU2147](https://github.com/YUYUYUYU2147) — [HoYoGet-Plugin](https://github.com/YUYUYUYU2147/HoYoGet-Plugin) (Honkai Impact 3rd self-help query reference)
- [@sunfkny](https://github.com/sunfkny) — [genshin-gacha-export-js](https://github.com/sunfkny/genshin-gacha-export-js)
- [UIGF-org](https://uigf.org/)

## License

[MIT](../LICENSE)
