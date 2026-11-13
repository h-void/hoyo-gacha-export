const { getItemTypeNameMap, order } = require('./gachaTypeMap')
const gachaTypeRaw = require('./gachaType.json')

const defaultTypeMap = new Map([
  ['301', '角色活动祈愿'],
  ['302', '武器活动祈愿'],
  ['500', '集录祈愿'],
  ['200', '常驻祈愿'],
  ['100', '新手祈愿']
])

module.exports = {
  id: 'genshin',
  uigfKey: 'hk4e',
  order,
  hiddenPoolKey: '100',
  itemFormat: 'tuple',
  defaultTypeMap,
  hasCloudLog: true,
  queryParamKey: 'gacha_type',
  defaultApiDomain: 'https://public-operation-hk4e.mihoyo.com',
  getApiDomain(host = '') {
    if (
      host.includes('webstatic-sea') ||
      host.includes('hk4e-api-os') ||
      host.includes('api-os-takumi') ||
      host.includes('hoyoverse.com')
    ) {
      return 'https://public-operation-hk4e-sg.hoyoverse.com'
    }
    return 'https://public-operation-hk4e.mihoyo.com'
  },
  getValidationUrl(domain, queryString) {
    return `${domain}/gacha_info/api/getConfigList?${queryString}`
  },
  getGachaLogUrl(domain, key, queryString) {
    return `${domain}/gacha_info/api/getGachaLog?${queryString}`
  },
  getGachaType(lang) {
    return getItemTypeNameMap(lang)
  },
  gachaTypeRaw,
  getLogEntries(userPath, logType, appLocale) {
    const entries = []
    const desktop = [
      { type: 'cn', path: `${userPath}/AppData/LocalLow/miHoYo/原神/output_log.txt`, mode: 'cache', regex: /\w:\/.+(GenshinImpact_Data|YuanShen_Data)/ },
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/Genshin Impact/output_log.txt`, mode: 'cache', regex: /\w:\/.+(GenshinImpact_Data|YuanShen_Data)/ }
    ]
    if (logType === 1) {
      entries.push(desktop[0])
    } else if (logType === 2) {
      entries.push(desktop[1])
    } else if (logType === 3) {
      entries.push({
        type: 'cloud',
        path: `${userPath}/AppData/Local/miHoYo/GenshinImpactCloudGame/config/logs/MiHoYoSDK.log`,
        mode: 'direct'
      })
    } else {
      if (appLocale !== 'zh-CN') {
        desktop.reverse()
      }
      entries.push(...desktop, {
        type: 'cloud',
        path: `${userPath}/AppData/Local/miHoYo/GenshinImpactCloudGame/config/logs/MiHoYoSDK.log`,
        mode: 'direct'
      })
    }
    return entries
  },
  urlRegex: /https.+?auth_appid=webview_gacha.+?authkey=.+?game_biz=hk4e_\w+/g,
  cleanSearchParams(searchParams) {
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
  },
  formatLocalLang(localLang) {
    if (!localLang) return ''
    if (!localLang.startsWith('zh-')) {
      return localLang.replace(/-\w+$/, '')
    }
    return localLang
  }
}
