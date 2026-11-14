# 米哈游抽卡记录导出工具

中文 | [English](./docs/README_EN.md)

这个项目基于 [genshin-wish-export](https://github.com/biuuu/genshin-wish-export)、[star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) 与 [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) 整合修改而来，支持 **《原神》**、**《崩坏：星穹铁道》**、**《绝区零》** 与 **《千星奇域》**（颂愿）。

一个使用 Electron 制作的小工具，支持 Windows、macOS 与 Linux。

通过读取游戏日志或者代理模式获取访问游戏抽卡记录 API 所需的 authKey，然后再使用获取到的 authKey 来读取游戏抽卡记录。

工具会在 `userData` 文件夹里按游戏分目录保存数据，获取到新的记录时，会与本地数据合并后保存（支持导出 Excel 与跨游戏 UIGF v4.2 JSON）。

## 使用说明

1. 下载工具后解压 - 下载地址: [GitHub Releases](https://github.com/h-void/hoyo-gacha-export/releases)
2. 打开游戏的抽卡历史记录 / 跃迁详情 / 调频详情 / 千星奇域颂愿历史页面
3. 在顶部选择对应游戏，点击工具的“加载数据”按钮

   ![加载数据](./docs/load-data.png)

   如果没出什么问题的话，你会看到正在读取数据的提示。若日志读取未能获取到链接，可在右上角“选项”中开启代理模式后再次打开游戏内历史页面。

如果需要导出多个账号的数据，可以点击旁边的加号按钮。

然后游戏切换新账号，再打开抽卡历史记录，工具再点击“加载数据”按钮。

## Development

```bash
# 安装模块
yarn install

# 开发模式
yarn dev

# 构建一个可以运行的程序
yarn build
```

## 致谢

- [@biuuu](https://github.com/biuuu) — [genshin-wish-export](https://github.com/biuuu/genshin-wish-export) / [star-rail-warp-export](https://github.com/biuuu/star-rail-warp-export) (`MIT License`)
- [@earthjasonlin](https://github.com/earthjasonlin) — [zzz-signal-search-export](https://github.com/earthjasonlin/zzz-signal-search-export) (`MIT License`)
- [@Scighost](https://github.com/Scighost) — [Starward](https://github.com/Scighost/Starward) (`MIT License`)
- [@GoneTone](https://github.com/GoneTone) — [genshin-impact-wish-gacha-analyzer](https://github.com/GoneTone/genshin-impact-wish-gacha-analyzer) (`MIT License`)
- [@sunfkny](https://github.com/sunfkny) — [genshin-gacha-export-js](https://github.com/sunfkny/genshin-gacha-export-js)
- [UIGF-org](https://uigf.org/)

## License

[MIT](./LICENSE)
