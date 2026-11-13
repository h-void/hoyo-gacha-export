# 米哈游四合一抽卡记录导出工具 (HoYo Gacha Export)

简体中文 | [English](./docs/README_EN.md)

基于 Electron + Vue 3 构建的桌面端米哈游抽卡记录四合一导出工具，将 **《原神》**、**《崩坏：星穹铁道》**、**《绝区零》** 与 **《千星奇域》**（Miliastra Wonderland 颂愿）整合在同一个应用中，支持通过读取游戏本地日志/缓存或系统代理抓包获取 API 链接，自动合并增量记录并导出为 Excel 或 UIGF v4.2 标准 JSON。

## 支持游戏与卡池

| 游戏 | 本地日志 / 缓存来源 | 支持卡池 | 特别支持 |
| --- | --- | --- | --- |
| **原神** (`hk4e`) | `output_log.txt` / `MiHoYoSDK.log` | 角色活动（含 `400` 双 UP 合并标注）、武器活动、集录祈愿 (`500`)、常驻、新手 | 云原神、UIGF v3.0 & v4.2、物品 ID 字典缓存 |
| **崩坏：星穹铁道** (`hkrpg`) | `Player.log`（国服 / 国际服） | 角色/光锥活动、联动角色/联动光锥跃迁 (`21`/`22`)、常驻、新手 | 兼容 SRGF v1.0 导入、内置 `idJson.json` 数据库 |
| **绝区零** (`nap`) | `Player.log` + `ZenlessZoneZero_Data` | 独家频段/重映 (`102`)、音擎频段/回响 (`103`)、邦布 (`5`)、常驻 | S/A/B 级与邦布独立统计、时区自动对齐 |
| **千星奇域** (`hk4e_ugc`) | `output_log.txt` / `MiHoYoSDK.log` | 活动颂愿 (`2000`，含男/女双子池 `20011`–`20022` 合并统计)、常驻颂愿 (`1000`) | 自动降级回落标准祈愿 URL、UIGF v4.2 (`hk4e_ugc`)、常驻 4 星保底与 2–5 星统计 |

## 主要功能

- **一键切换四款模块**：顶部切换栏即时切换《原神》《星穹铁道》《绝区零》《千星奇域》，各模块账号、UID、链接缓存与池子设置彼此隔离。
- **自动隔离与旧数据迁移**：本地数据按模块存放在 `userData/{genshin,starrail,zzz,beyond}/` 目录中；检测到根目录旧版单游戏 `gacha-list-*.json` 或旧版 `config.json` 时自动识别并无损迁移。
- **千星奇域专属适配**：
  - 使用 `getBeyondGachaLog`（`size=5`，全量语言代码规范化如 `en-us`/`ja-jp`/`zh-cn`）抓取颂愿记录，并在 `authkey` 来自标准祈愿网页或返回空 UID 时自动通过标准祈愿接口探测账号 UID。
  - 系统代理模式同步拦截国服 `webstatic*.mihoyo.com` 与国际服 `gs.hoyoverse.com`（`e20250716gacha`）链接。
  - **活动颂愿 (`2000`)** 按 5★ 保底统计并将 `20011`/`20012`/`20021`/`20022` 子卡池标注在悬浮提示与 Excel 备注栏；**常驻颂愿 (`1000`)** 按 4★ 保底统计并独立展示 4★/3★/2★ 分布。
- **跨游戏 UIGF v4.2 与多格式导入导出**：
  - 导出 **Excel (`.xlsx`)**：分卡池工作表 + `rawData` 原始数据表，含保底计数、星级着色与子卡池备注。
  - 导出 **UIGF v4.2**：支持在弹窗中任意勾选跨越《原神》《星穹铁道》《绝区零》《千星奇域》的多个 UID 合并为一份标准 `hk4e` + `hkrpg` + `nap` + `hk4e_ugc` JSON 文件；《原神》模式下亦保留 UIGF v3.0 导出按钮。
  - 导入兼容：**UIGF v4.0 / v4.1 / v4.2**、**UIGF v3.0**（原神）、**SRGF v1.0**（星穹铁道）以及旧版工具生成的本地 `gacha-list-*.json`。

## 使用说明

1. 从 [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases) 下载对应平台的压缩包并解压（或自行构建）。
2. 打开对应游戏的**抽卡历史记录 / 跃迁详情 / 调频详情 / 千星奇域颂愿历史**页面（确保客户端已刷新记录）。
3. 在本工具顶部选择对应游戏，点击「**加载数据**」。
4. 若同一游戏需要导出多个账号，可点击 UID 旁边的 `+` 按钮切换新账号并在游戏内打开对应账号的历史页面后再次加载。

## 开发与构建

需要 Node.js (>= 22 LTS) 与 Yarn：

```bash
# 安装依赖
yarn install

# 开发模式（热重载）
yarn dev

# 运行单元测试
yarn test

# 仅编译主进程与渲染进程产物
yarn build:app

# 打包发布版桌面安装包
yarn build:win64   # 或 build:win32 / build:linux / build:mac
```

更新内置《星穹铁道》与《绝区零》物品 ID 映射表（需 Python 3 + `requests`、`opencc`）：

```bash
python tools/getIdMap.py --game all
```

## 致谢与上游项目声明

本项目基于以下开源项目整合与二次开发而成，完整保留原作者版权声明并继续采用 **MIT License** 开源，特此向原作者们致以诚挚感谢：

- **[@biuuu](https://github.com/biuuu) — [`biuuu/genshin-wish-export`](https://github.com/biuuu/genshin-wish-export)** (`MIT License, Copyright (c) 2021 biuuu`)
  - 提供了整体 Electron + Vue 3 + Tailwind 架构、`genshin` 卡池映射、日志定位、系统代理抓取、UIGF Schema 与物品字典查询等核心实现。
- **[@biuuu](https://github.com/biuuu) — [`biuuu/star-rail-warp-export`](https://github.com/biuuu/star-rail-warp-export)** (`MIT License, Copyright (c) 2023 biuuu`)
  - 提供了《崩坏：星穹铁道》跃迁日志/API 适配、联动池 (`21`/`22`) 支持、SRGF 导入、`idJson.json` 映射与自动化同步脚本原型。
- **[@earthjasonlin](https://github.com/earthjasonlin) — [`earthjasonlin/zzz-signal-search-export`](https://github.com/earthjasonlin/zzz-signal-search-export)** (`MIT License, Copyright (c) 2024 earthjasonlin`)
  - 提供了《绝区零》调频接口 (`real_gacha_type`) 适配、独家重映/音擎回响 (`102`/`103`) 卡池、邦布与 S/A/B 级图表逻辑、服务器时区转换及 `idJson.json` 数据源。
- **[@Scighost](https://github.com/Scighost) — [`Scighost/Starward`](https://github.com/Scighost/Starward)** (`MIT License`)
  - 提供了千星奇域 (`getBeyondGachaLog`) 接口参数规范（`size=5`、全量语言代码、`gs.hoyoverse.com` URL 规则）及 UIGF v4.2 (`hk4e_ugc`) 协议参考。
- **[@GoneTone](https://github.com/GoneTone) — [`GoneTone/genshin-impact-wish-gacha-analyzer`](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer)** (`MIT License`)
  - 提供了千星奇域颂愿保底机制（常驻 4★ 70 抽保底 / 活动 5★ 70 抽保底）、子卡池说明与空 UID 回落探测设计参考。
- **[@sunfkny](https://github.com/sunfkny) — [`sunfkny/genshin-gacha-export-js`](https://github.com/sunfkny/genshin-gacha-export-js)**
  - 早期 ExcelJS 导出样式与数据结构设计灵感来源。
- **[UIGF-org](https://uigf.org/)**
  - 统一可交换抽卡记录标准 (UIGF v3.0 / v4.0 / v4.1 / v4.2 / SRGF) 及原神物品 ID 查询接口。

## License

[MIT](./LICENSE)
