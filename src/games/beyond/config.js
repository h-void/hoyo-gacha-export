const gachaTypeRaw = require('./gachaType.json')
const {
  order,
  normalizeBeyondLang,
  getBeyondGachaTypeMap,
  getSubPoolLabel,
  normalizeBeyondPoolKey
} = require('./gachaTypeMap')

const defaultTypeMap = new Map([
  ['2000', '活动颂愿'],
  ['1000', '常驻颂愿']
])

const serverTimeZone = new Map([
  ['cn_gf01', 8],
  ['cn_qd01', 8],
  ['os_asia', 8],
  ['os_cht', 8],
  ['os_usa', -5],
  ['os_euro', 1]
])

module.exports = {
  id: 'beyond',
  uigfKey: 'hk4e_ugc',
  order,
  hiddenPoolKey: '1000',
  itemFormat: 'object',
  pageSize: 5,
  defaultTypeMap,
  serverTimeZone,
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
    return `${domain}/gacha_info/api/getBeyondGachaLog?${queryString}&gacha_type=1000&page=1&size=5&end_id=0`
  },
  getGachaLogUrl(domain, key, queryString) {
    return `${domain}/gacha_info/api/getBeyondGachaLog?${queryString}`
  },
  getFallbackUidUrls(domain, queryString) {
    return ['301', '200', '302', '500', '100'].map(
      pool => `${domain}/gacha_info/api/getGachaLog?${queryString}&gacha_type=${pool}&page=1&size=5&end_id=0`
    )
  },
  getGachaType(lang) {
    return getBeyondGachaTypeMap(lang)
  },
  getSubPoolLabel,
  normalizePoolKey: normalizeBeyondPoolKey,
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
  urlRegex: /https?:\/\/[^\x00-\x20"'<>]+?(?:e20250716gacha|getBeyondGachaLog)[^\x00-\x20"'<>]*?authkey=[^&\x00-\x20"'<>]+[^\x00-\x20"'<>]*/g,
  fallbackUrlRegex: /https?:\/\/[^\x00-\x20"'<>]+?auth_appid=webview_gacha[^\x00-\x20"'<>]*?authkey=[^\x00-\x20"'<>]*?game_biz=hk4e_\w+/g,
  cleanSearchParams(searchParams) {
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
    const rawLang = searchParams.get('lang')
    if (rawLang) {
      const normalized = normalizeBeyondLang(rawLang)
      if (normalized) {
        searchParams.set('lang', normalized)
      }
    }
  },
  formatLocalLang(localLang) {
    return normalizeBeyondLang(localLang)
  }
}
