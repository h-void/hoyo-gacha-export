const config = require('./config')
const { isPlainObject } = require('./utils')
const { GAME_IDS, gameI18n } = require('../games/registry')

const unifiedOverrides = {
  'zh-cn': {
    'ui.win.appTitle': '米哈游抽卡记录导出工具',
    'ui.game.genshin': '原神',
    'ui.game.starrail': '星穹铁道',
    'ui.game.zzz': '绝区零',
    'ui.button.files': '导入/导出',
    'ui.button.uigf': '导出UIGF',
    'ui.button.import': '导入UIGF',
    'ui.button.cloud': '云原神',
    'ui.button.copyApiUrl': '复制API链接',
    'ui.extra.apiUrlCopied': 'API链接已复制',
    'ui.common.data': '数据',
    'ui.common.dataManage': '数据管理',
    'ui.common.game': '游戏',
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
    'ui.setting.uigfGenshinTitle': '原神 UIGF 选项',
    'ui.setting.uigf30Export': '导出原神 UIGF v3.0',
    'ui.uigf.title': '请选择要导出的账号 (UIGF v4.1)',
    'ui.uigf.selectAll': '全选',
    'ui.uigf.emptySelection': '请至少选择一个账号',
    'ui.uigf.importSuccess': '数据导入成功',
    'ui.uigf.exportSuccess': 'UIGF 数据导出成功',
    'uigf.fileType': '统一可交换抽卡记录标准 v4.0 / v4.1 / v3.0',
    'ui.about.license': '本工具为开源软件，源代码使用 MIT 协议授权',
    'ui.about.creditsTitle': '致谢与上游项目声明',
    'ui.about.creditsIntro': '本项目将以下开源项目整合为三合一桌面工具，谨向原作者致以诚挚感谢：'
  },
  'zh-tw': {
    'ui.win.appTitle': '米哈遊抽卡紀錄匯出工具',
    'ui.game.genshin': '原神',
    'ui.game.starrail': '星穹鐵道',
    'ui.game.zzz': '絕區零',
    'ui.button.files': '匯入/匯出',
    'ui.button.uigf': '匯出UIGF',
    'ui.button.import': '匯入UIGF',
    'ui.button.cloud': '雲原神',
    'ui.button.copyApiUrl': '複製API連結',
    'ui.extra.apiUrlCopied': 'API連結已複製',
    'ui.common.data': '資料',
    'ui.common.dataManage': '資料管理',
    'ui.common.game': '遊戲',
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
    'ui.setting.uigfGenshinTitle': '原神 UIGF 選項',
    'ui.setting.uigf30Export': '匯出原神 UIGF v3.0',
    'ui.uigf.title': '請選擇要匯出的帳號 (UIGF v4.1)',
    'ui.uigf.selectAll': '全選',
    'ui.uigf.emptySelection': '請至少選擇一個帳號',
    'ui.uigf.importSuccess': '資料匯入成功',
    'ui.uigf.exportSuccess': 'UIGF 資料匯出成功',
    'uigf.fileType': '統一可交換抽卡紀錄標準 v4.0 / v4.1 / v3.0',
    'ui.about.license': '本工具為開源軟體，原始碼使用 MIT 授權條款',
    'ui.about.creditsTitle': '致謝與上游專案聲明',
    'ui.about.creditsIntro': '本專案將以下開源專案整合為三合一桌面工具，謹向原作者致以誠摯感謝：'
  },
  'en-us': {
    'ui.win.appTitle': 'HoYo Gacha History Exporter',
    'ui.game.genshin': 'Genshin Impact',
    'ui.game.starrail': 'Honkai: Star Rail',
    'ui.game.zzz': 'Zenless Zone Zero',
    'ui.button.files': 'Import/Export',
    'ui.button.uigf': 'Export UIGF',
    'ui.button.import': 'Import UIGF',
    'ui.button.cloud': 'Cloud Genshin',
    'ui.button.copyApiUrl': 'Copy API URL',
    'ui.extra.apiUrlCopied': 'API URL Copied',
    'ui.common.data': 'Data',
    'ui.common.dataManage': 'Data Management',
    'ui.common.game': 'Game',
    'ui.common.updateTime': 'Update Date',
    'ui.common.status': 'Status',
    'ui.common.action': 'Action',
    'ui.common.deleted': 'Deleted',
    'ui.common.normal': 'Normal',
    'ui.common.delete': 'Delete',
    'ui.common.restore': 'Restore',
    'ui.setting.dataManagerHint': 'Unnecessary local records can be hidden or restored.',
    'ui.setting.idVersion': 'ID database version',
    'ui.setting.uigfAllAccounts': 'Export all selected accounts (cross-game UIGF v4.1)',
    'ui.setting.uigfReadable': 'Readable JSON',
    'ui.setting.uigfGenshinTitle': 'Genshin UIGF Options',
    'ui.setting.uigf30Export': 'Export Genshin UIGF v3.0',
    'ui.uigf.title': 'Select accounts to export (UIGF v4.1)',
    'ui.uigf.selectAll': 'Select All',
    'ui.uigf.emptySelection': 'Please select at least one account',
    'ui.uigf.importSuccess': 'Data imported successfully',
    'ui.uigf.exportSuccess': 'UIGF data exported successfully',
    'uigf.fileType': 'Uniformed Interchangeable GachaLog Format v4.0 / v4.1 / v3.0',
    'ui.about.license': 'This software is open source under the MIT License.',
    'ui.about.creditsTitle': 'Credits & Upstream Attribution',
    'ui.about.creditsIntro': 'This 3-in-1 tool unifies the following upstream open-source projects with gratitude to their authors:'
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
          // ZZZ lacks non-zh/en translations: still honor unified overlay
          base = assignData(base, unifiedOverrides['en-us'])
        }
      }
      // Normalize hideHiddenPool across games cleanly
      if (gameId === 'zzz') {
        base['ui.setting.hideHiddenPool'] = base['ui.setting.hideStandard'] || 'Hide Standard Banner'
      } else {
        base['ui.setting.hideHiddenPool'] = base['ui.setting.hideNovice'] || 'Hide Starter Banner'
      }
      // Ensure star5/star4 keys exist without breaking upstream templates
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
