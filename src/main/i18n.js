const config = require('./config')
const { isPlainObject } = require('./utils')
const { GAME_IDS, gameI18n } = require('../games/registry')

const LOCALIZED_GAME_NAMES = {
  beyond: {
    'zh-cn': '千星奇域',
    'zh-tw': '千星奇域',
    'ja-jp': '星々の幻境',
    'ko-kr': '별바다 세계'
  },
  starrail_blindbox: {
    'zh-cn': '星际潮玩',
    'zh-tw': '星際潮玩',
    'ja-jp': '星間トレンドトイ',
    'ko-kr': '성간 트렌드 토이'
  },
  bh3: {
    'zh-cn': '崩坏3',
    'zh-tw': '崩壞3rd',
    'ja-jp': '崩壊3rd',
    'ko-kr': '붕괴3rd'
  },
  petitplanet: {
    'zh-cn': '星布谷地',
    'zh-tw': '星布谷地',
    'ja-jp': 'プチプラネット',
    'ko-kr': '쁘띠 플래닛'
  },
  nexusanima: {
    'zh-cn': '因缘精灵',
    'zh-tw': '因緣精靈',
    'ja-jp': '崩壊：ネクサスアニマ',
    'ko-kr': '붕괴: 넥서스 아니마'
  }
}

const unifiedOverrides = {
  'zh-cn': {
    'ui.win.appTitle': '米哈游抽卡记录导出工具',
    'ui.game.genshin': '原神',
    'ui.game.beyond': '千星奇域',
    'ui.game.starrail': '星穹铁道',
    'ui.game.starrail_blindbox': '星际潮玩',
    'ui.game.zzz': '绝区零',
    'ui.game.bh3': '崩坏3',
    'ui.game.petitplanet': '星布谷地',
    'ui.game.nexusanima': '因缘精灵',
    'ui.gameGroup.more': '更多游戏',
    'ui.gameStatus.upcoming_hyg': '12/04公测',
    'ui.gameStatus.upcoming_hna': '2027春',
    'ui.gameType.label': '类型',
    'ui.gameType.poolFilter': '卡池',
    'ui.gameType.allPools': '全部卡池',
    'ui.gameType.wish': '祈愿',
    'ui.gameType.beyond': '千星奇域 · 颂愿',
    'ui.gameType.warp': '跃迁',
    'ui.gameType.blindbox': '星际潮玩',
    'ui.gameType.signal': '调频',
    'ui.gameType.supply': '补给',
    'ui.gameType.gacha': '抽卡',
    'ui.button.files': '导入/导出',
    'ui.button.uigf': '导出UIGF',
    'ui.button.exportGameJson': '导出当前游戏JSON',
    'ui.button.import': '导入JSON / UIGF',
    'ui.button.cloud': '云原神',
    'ui.button.copyApiUrl': '复制API链接',
    'ui.extra.apiUrlCopied': 'API链接已复制',
    'ui.common.data': '数据',
    'ui.common.dataManage': '数据管理',
    'ui.common.game': '游戏',
    'ui.common.type': '类型',
    'ui.common.updateTime': '更新日期',
    'ui.common.status': '状态',
    'ui.common.action': '操作',
    'ui.common.deleted': '已删除',
    'ui.common.normal': '正常',
    'ui.common.delete': '删除',
    'ui.common.restore': '恢复',
    'ui.setting.dataManagerHint': '可以删除或恢复不需要的本地记录。',
    'ui.setting.idVersion': 'ID 数据库版本',
    'ui.setting.uigfAllAccounts': '导出全部选中账号（支持跨游戏合并）',
    'ui.setting.uigfReadable': '格式化JSON',
    'ui.setting.uigfGenshinTitle': 'JSON / UIGF 选项',
    'ui.setting.uigf30Export': '导出原神 UIGF v3.0',
    'ui.uigf.title': '请选择要导出的账号 (UIGF v4.2)',
    'ui.uigf.selectAll': '全选',
    'ui.uigf.emptySelection': '请至少选择一个账号',
    'ui.uigf.importSuccess': '数据导入成功',
    'ui.uigf.exportSuccess': '数据导出成功',
    'uigf.fileType': '抽卡记录 JSON (UIGF v4.2 / v3.0 / 可移植备份)',
    'ui.about.license': '本工具为开源软件，源代码使用 MIT 协议授权',
    'ui.about.creditsTitle': '致谢与上游项目声明',
    'ui.about.creditsIntro': '本项目整合了米哈游全系电脑端游戏抽卡记录导出能力，参考并致谢以下开源项目：'
  },
  'zh-tw': {
    'ui.win.appTitle': '米哈遊抽卡紀錄匯出工具',
    'ui.game.genshin': '原神',
    'ui.game.beyond': '千星奇域',
    'ui.game.starrail': '星穹鐵道',
    'ui.game.starrail_blindbox': '星際潮玩',
    'ui.game.zzz': '絕區零',
    'ui.game.bh3': '崩壞3rd',
    'ui.game.petitplanet': '星布谷地',
    'ui.game.nexusanima': '因緣精靈',
    'ui.gameGroup.more': '更多遊戲',
    'ui.gameStatus.upcoming_hyg': '12/04公測',
    'ui.gameStatus.upcoming_hna': '2027春',
    'ui.gameType.label': '類型',
    'ui.gameType.poolFilter': '卡池',
    'ui.gameType.allPools': '全部卡池',
    'ui.gameType.wish': '祈願',
    'ui.gameType.beyond': '千星奇域 · 頌願',
    'ui.gameType.warp': '躍遷',
    'ui.gameType.blindbox': '星際潮玩',
    'ui.gameType.signal': '調頻',
    'ui.gameType.supply': '補給',
    'ui.gameType.gacha': '抽卡',
    'ui.button.files': '匯入/匯出',
    'ui.button.uigf': '匯出UIGF',
    'ui.button.exportGameJson': '匯出目前遊戲JSON',
    'ui.button.import': '匯入JSON / UIGF',
    'ui.button.cloud': '雲原神',
    'ui.button.copyApiUrl': '複製API連結',
    'ui.extra.apiUrlCopied': 'API連結已複製',
    'ui.common.data': '資料',
    'ui.common.dataManage': '資料管理',
    'ui.common.game': '遊戲',
    'ui.common.type': '類型',
    'ui.common.updateTime': '更新日期',
    'ui.common.status': '狀態',
    'ui.common.action': '操作',
    'ui.common.deleted': '已刪除',
    'ui.common.normal': '正常',
    'ui.common.delete': '刪除',
    'ui.common.restore': '恢復',
    'ui.setting.dataManagerHint': '可以刪除或恢復不需要的本地紀錄。',
    'ui.setting.idVersion': 'ID 資料庫版本',
    'ui.setting.uigfAllAccounts': '匯出全部選中帳號（支援跨遊戲合併）',
    'ui.setting.uigfReadable': '格式化JSON',
    'ui.setting.uigfGenshinTitle': 'JSON / UIGF 選項',
    'ui.setting.uigf30Export': '匯出原神 UIGF v3.0',
    'ui.uigf.title': '請選擇要匯出的帳號 (UIGF v4.2)',
    'ui.uigf.selectAll': '全選',
    'ui.uigf.emptySelection': '請至少選擇一個帳號',
    'ui.uigf.importSuccess': '資料匯入成功',
    'ui.uigf.exportSuccess': '資料匯出成功',
    'uigf.fileType': '抽卡紀錄 JSON (UIGF v4.2 / v3.0 / 可移植備份)',
    'ui.about.license': '本工具為開源軟體，原始碼使用 MIT 授權條款',
    'ui.about.creditsTitle': '致謝與上游專案聲明',
    'ui.about.creditsIntro': '本專案整合了米哈遊全系列電腦端遊戲抽卡紀錄匯出能力，參考並致謝以下開源專案：'
  },
  'en-us': {
    'ui.win.appTitle': 'HoYo Gacha History Exporter',
    'ui.game.genshin': 'Genshin Impact',
    'ui.game.beyond': 'Miliastra Wonderland',
    'ui.game.starrail': 'Honkai: Star Rail',
    'ui.game.starrail_blindbox': 'Interstellar Collectibles',
    'ui.game.zzz': 'Zenless Zone Zero',
    'ui.game.bh3': 'Honkai Impact 3rd',
    'ui.game.petitplanet': 'Petit Planet',
    'ui.game.nexusanima': 'Honkai: Nexus Anima',
    'ui.gameGroup.more': 'More Games',
    'ui.gameStatus.upcoming_hyg': 'Dec 4',
    'ui.gameStatus.upcoming_hna': '2027',
    'ui.gameType.label': 'Type',
    'ui.gameType.poolFilter': 'Banner',
    'ui.gameType.allPools': 'All Banners',
    'ui.gameType.wish': 'Wish',
    'ui.gameType.beyond': 'Miliastra Wonderland (Odes)',
    'ui.gameType.warp': 'Warp',
    'ui.gameType.blindbox': 'Interstellar Collectibles',
    'ui.gameType.signal': 'Signal Search',
    'ui.gameType.supply': 'Supply',
    'ui.gameType.gacha': 'Gacha',
    'ui.button.files': 'Import/Export',
    'ui.button.uigf': 'Export UIGF',
    'ui.button.exportGameJson': 'Export Game JSON',
    'ui.button.import': 'Import JSON / UIGF',
    'ui.button.cloud': 'Cloud Genshin',
    'ui.button.copyApiUrl': 'Copy API URL',
    'ui.extra.apiUrlCopied': 'API URL Copied',
    'ui.common.data': 'Data',
    'ui.common.dataManage': 'Data Management',
    'ui.common.game': 'Game',
    'ui.common.type': 'Type',
    'ui.common.updateTime': 'Update Date',
    'ui.common.status': 'Status',
    'ui.common.action': 'Action',
    'ui.common.deleted': 'Deleted',
    'ui.common.normal': 'Normal',
    'ui.common.delete': 'Delete',
    'ui.common.restore': 'Restore',
    'ui.setting.dataManagerHint': 'Unnecessary local records can be hidden or restored.',
    'ui.setting.idVersion': 'ID database version',
    'ui.setting.uigfAllAccounts': 'Export all selected accounts (cross-game UIGF v4.2)',
    'ui.setting.uigfReadable': 'Readable JSON',
    'ui.setting.uigfGenshinTitle': 'JSON / UIGF Options',
    'ui.setting.uigf30Export': 'Export Genshin UIGF v3.0',
    'ui.uigf.title': 'Select accounts to export (UIGF v4.2)',
    'ui.uigf.selectAll': 'Select All',
    'ui.uigf.emptySelection': 'Please select at least one account',
    'ui.uigf.importSuccess': 'Data imported successfully',
    'ui.uigf.exportSuccess': 'Data exported successfully',
    'uigf.fileType': 'Gacha History JSON (UIGF v4.2 / v3.0 / Portable Backup)',
    'ui.about.license': 'This software is open source under the MIT License.',
    'ui.about.creditsTitle': 'Credits & Upstream Attribution',
    'ui.about.creditsIntro': 'This unified HoYoverse PC gacha exporter integrates and adapts the following open-source projects with gratitude to their authors:'
  }
}

const addProp = (obj, key) => {
  if (isPlainObject(obj[key])) {
    return obj[key]
  }
  const temp = {}
  obj[key] = temp
  return temp
}

const parseData = (data) => {
  const result = {}
  for (const key in data) {
    let temp = result
    const arr = key.split('.')
    arr.forEach((prop, index) => {
      if (index === arr.length - 1) {
        temp[prop] = data[key]
      } else {
        temp = addProp(temp, prop)
      }
    })
  }
  return result
}

const assignData = (objA, objB) => {
  const temp = { ...objA }
  if (!objB) return temp
  for (const key in objB) {
    if (objB[key]) {
      temp[key] = objB[key]
    }
  }
  return temp
}

const allLangs = Object.keys(gameI18n.genshin)
const i18nMapByGame = new Map()

const prepareData = () => {
  for (const gameId of GAME_IDS) {
    const raw = gameI18n[gameId]
    const gameMap = new Map()
    for (const lang of allLangs) {
      let base
      if (lang === 'zh-tw') {
        base = assignData(raw['zh-cn'], raw['zh-tw'])
        base = assignData(assignData(unifiedOverrides['zh-cn'], unifiedOverrides['zh-tw']), base)
        // Re-apply explicit overrides for keys added for unified UI
        base = assignData(base, unifiedOverrides['zh-tw'])
      } else if (lang === 'zh-cn') {
        base = assignData(raw['zh-cn'], unifiedOverrides['zh-cn'])
      } else {
        base = assignData(
          raw['zh-cn'],
          assignData(raw['en-us'], raw[lang] || {})
        )
        base = assignData(assignData(unifiedOverrides['zh-cn'], unifiedOverrides['en-us']), base)
        if (!raw[lang]) {
          // Games without full 13-language packs still honor unified English overlay
          base = assignData(base, unifiedOverrides['en-us'])
        }
      }
      for (const [gKey, langTable] of Object.entries(LOCALIZED_GAME_NAMES)) {
        if (langTable[lang]) {
          base[`ui.game.${gKey}`] = langTable[lang]
        }
      }
      // Normalize hideHiddenPool across games cleanly
      if (gameId === 'zzz' || gameId === 'beyond') {
        base['ui.setting.hideHiddenPool'] = base['ui.setting.hideStandard'] || 'Hide Standard Banner'
      } else if (gameId === 'bh3') {
        base['ui.setting.hideHiddenPool'] = base['ui.setting.hideDorm'] || 'Hide Dorm Supply'
      } else {
        base['ui.setting.hideHiddenPool'] = base['ui.setting.hideNovice'] || 'Hide Starter Banner'
      }
      gameMap.set(lang, parseData(base))
    }
    i18nMapByGame.set(gameId, gameMap)
  }
}

prepareData()

const parseText = (text, data = {}) => {
  return String(text).replace(/(\${.+?})/g, (...args) => {
    const key = args[0].slice(2, args[0].length - 1)
    if (typeof data[key] !== 'undefined' && data[key] !== null) return data[key]
    return args[0]
  })
}

const forGame = (gameId = config.currentGame, lang = config.lang) => {
  const gameMap = i18nMapByGame.get(gameId) || i18nMapByGame.get('genshin')
  return gameMap.get(lang) || gameMap.get('en-us') || gameMap.get('zh-cn')
}

const mainProps = ['symbol', 'ui', 'log', 'excel', 'uigf']

const i18n = new Proxy({}, {
  get(obj, prop) {
    const activeData = forGame(config.currentGame, config.lang)
    if (prop === 'data') {
      return activeData
    }
    if (mainProps.includes(prop)) {
      return activeData[prop]
    }
    if (prop === 'parse') {
      return parseText
    }
    if (prop === 'forGame') {
      return forGame
    }
    return gameI18n[config.currentGame]?.[prop]
  }
})

module.exports = i18n
