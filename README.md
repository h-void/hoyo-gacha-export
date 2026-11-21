# 米哈游抽卡记录导出工具

中文 | [English](./docs/README_EN.md)

基于 [genshin-wish-export](https://github.com/biuuu/genshin-wish-export)、[star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) 与 [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) 整合扩展而来，面向米哈游全系游戏的一体化抽卡记录导出与分析桌面工具（支持 Windows、macOS 与 Linux）。

## 支持矩阵（仅含电脑端游戏，按游戏 → 类型分层）

工具界面采用 **「先选游戏 → 再选类型 → 按卡池筛选」** 分层导航，仅展示有电脑端的米哈游游戏，全系坚持 **免账号登录 / 零 SToken** 原则：

| 游戏 | 记录类型 | 接入状态 | 获取方式 | 导出 / 导入格式 |
| --- | --- | --- | --- | --- |
| **《原神》** | 祈愿（角色/武器/集录/常驻/新手） | 已直连 | 日志缓存 / 代理 / 手动 URL / 云原神 | Excel、UIGF v4.2 (`hk4e`) / v3.0、可移植 JSON |
| **《原神》** | 千星奇域 · 颂愿（活动/常驻） | 已直连 | 日志缓存 / 代理 / 手动 URL / 云原神 | Excel、UIGF v4.2 (`hk4e_ugc`)、可移植 JSON |
| **《崩坏：星穹铁道》** | 跃迁（角色/光锥/联动/常驻/新手） | 已直连 | 日志缓存 / 代理 / 手动 URL | Excel、UIGF v4.2 (`hkrpg`)、SRGF 导入、可移植 JSON |
| **《崩坏：星穹铁道》** | 星际潮玩（`getBlindBoxLog`） | 已直连 | 日志缓存 / 代理 / 手动 URL（含跃迁回退） | Excel、可移植 JSON (`hkrpg_blindbox`) |
| **《绝区零》** | 调频（独家/音擎/邦布/重映/常驻） | 已直连 | 日志缓存 / 代理 / 手动 URL（兼容 2026 新域名） | Excel、UIGF v4.2 (`nap`)、可移植 JSON |
| **《崩坏3》** | 补给（角色/装备/协同/服装/家园等） | 已直连 | 官方 `bh3_self_help_query` + 图鉴星级（近 30 天） | Excel、可移植 JSON (`bh3`)、HoYoGet JSON 导入 |
| **《星布谷地》** | 抽卡 | 更多游戏（2026-12-04 公测） | 待正式服 API 公布后接入 | 可移植 JSON (`hyg`) 导入导出、Excel |
| **《崩坏：因缘精灵》** | 抽卡 | 更多游戏（2027 春） | 待正式服 API 公布后接入 | 可移植 JSON (`hna`) 导入导出、Excel |

工具会在 `userData` 文件夹里按游戏/类型分目录保存数据，获取到新的记录时会自动与本地数据去重合并后保存。

## 使用说明

1. 下载工具后解压 - 下载地址: [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases)
2. 在游戏内打开对应的历史记录页面：
   - 《原神》/《千星奇域》/《星穹铁道》/《星际潮玩》/《绝区零》：打开游戏内祈愿 / 颂愿 / 跃迁 / 星际潮玩 / 调频历史记录页面
   - 《崩坏3》：打开游戏内 **客服与帮助 → 服务中心 → 自助查询 → 补给记录**（官方自助查询通常仅保留近 30 天记录，建议定期同步）
3. 在顶部选择对应游戏，点击工具的“加载数据”按钮

   ![加载数据](./docs/load-data.png)

   如果没出什么问题的话，你会看到正在读取数据的提示。若日志读取未能获取到链接，可在右上角“选项”中开启代理模式或手动粘贴捕获到的 authkey URL。

如果需要导出多个账号的数据，可以点击旁边的加号按钮，然后游戏切换新账号，再打开历史记录页面后点击“加载数据”。

## Development

```bash
# 安装模块
yarn install

# 开发模式
yarn dev

# 运行测试
yarn test

# 构建一个可以运行的程序
yarn build
```

## 致谢

- [@biuuu](https://github.com/biuuu) — [genshin-wish-export](https://github.com/biuuu/genshin-wish-export) / [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) (`MIT License`)
- [@earthjasonlin](https://github.com/earthjasonlin) — [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) (`MIT License`)
- [@Scighost](https://github.com/Scighost) — [Starward](https://github.com/Scighost/Starward) (`MIT License`)
- [@GoneTone](https://github.com/GoneTone) — [genshin-impact-wish-gacha-analyzer](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer) (`MIT License`)
- [@Neroliu](https://github.com/Neroliu) — [BBBUID](https://github.com/Neroliu/BBBUID) & [@YUYUYUYU2147](https://github.com/YUYUYUYU2147) — [HoYoGet-Plugin](https://github.com/YUYUYUYU2147/HoYoGet-Plugin)（崩坏3自助查询接口参考）
- [@sunfkny](https://github.com/sunfkny) — [genshin-gacha-export-js](https://github.com/sunfkny/genshin-gacha-export-js)
- [UIGF-org](https://uigf.org/)

## License

[MIT](./LICENSE)
