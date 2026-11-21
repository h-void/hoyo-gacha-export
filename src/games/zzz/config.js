const gachaTypeRaw = require('./gachaType.json')

const order = ['2', '3', '5', '102', '103', '1']

const defaultTypeMap = new Map([
  ['2', '独家频段'],
  ['3', '音擎频段'],
  ['1', '常驻频段'],
  ['5', '邦布频段'],
  ['102', '独家重映'],
  ['103', '音擎回响']
])

const serverTimeZone = new Map([
  ['prod_gf_cn', 8],
  ['prod_gf_jp', 8],
  ['prod_gf_us', -5],
  ['prod_gf_eu', 1],
  ['prod_gf_sg', 8]
])

const gachaTypeMap = new Map(gachaTypeRaw)

function getGachaType(lang, detectLocaleFn) {
  const locale = detectLocaleFn ? detectLocaleFn(lang) : lang
  const list = gachaTypeMap.get(locale || lang) || gachaTypeMap.get('en-us') || gachaTypeMap.get('zh-cn')
  const map = new Map()
  if (list) {
    for (const item of list) {
      map.set(item.key, item.name)
    }
  }
  return map
}

module.exports = {
  id: 'zzz',
  availability: 'active',
  uigfKey: 'nap',
  order,
  hiddenPoolKey: '1',
  itemFormat: 'object',
  defaultTypeMap,
  serverTimeZone,
  hasCloudLog: false,
  queryParamKey: 'real_gacha_type',
  defaultApiDomain: 'https://public-operation-nap.mihoyo.com',
  getApiDomain(host = '') {
    if (host.includes('public-operation-common-sg')) {
      return 'https://public-operation-common-sg.hoyoverse.com'
    }
    if (host.includes('public-operation-common')) {
      return 'https://public-operation-common.mihoyo.com'
    }
    if (
      host.includes('webstatic-sea') ||
      host.includes('api-os-takumi') ||
      host.includes('hoyoverse.com')
    ) {
      return 'https://public-operation-nap-sg.hoyoverse.com'
    }
    return 'https://public-operation-nap.mihoyo.com'
  },
  getValidationUrl(domain, queryString) {
    return `${domain}/common/gacha_record/api/getGachaLog?${queryString}&page=1&size=5&real_gacha_type=1&end_id=0`
  },
  getGachaLogUrl(domain, key, queryString) {
    return `${domain}/common/gacha_record/api/getGachaLog?${queryString}`
  },
  getGachaType,
  gachaTypeRaw,
  getLogEntries(userPath, logType, appLocale) {
    const entries = [
      {
        type: 'cn',
        path: `${userPath}/AppData/LocalLow/miHoYo/绝区零/Player.log`,
        mode: 'zzz',
        regex: /([A-Z]:\/.*?\/)(?=ZenlessZoneZero_Data)/i
      },
      {
        type: 'os',
        path: `${userPath}/AppData/LocalLow/miHoYo/ZenlessZoneZero/Player.log`,
        mode: 'zzz',
        regex: /([A-Z]:\/.*?\/)(?=ZenlessZoneZero_Data)/i
      }
    ]
    if (logType === 1) {
      return [entries[0]]
    } else if (logType === 2) {
      return [entries[1]]
    }
    if (appLocale !== 'zh-CN') {
      entries.reverse()
    }
    return entries
  },
  urlRegex: /https?:\/\/(?![^\x00-\x20\x7f-\uffff"'<>]*?(?:bh3_self_help_query|hkrpg_gacha_record|getBeyondGachaLog|game_biz=(?:hk4e|hkrpg|bh3)_))(?=[^\x00-\x20\x7f-\uffff"'<>]*?(?:-nap|\/nap\/|e20230424gacha|game_biz=nap_\w+|real_gacha_type=|\/common\/gacha_record\/api\/getGachaLog))[^?\x00-\x20\x7f-\uffff"'<>]+\?(?=[^\x00-\x20\x7f-\uffff"'<>]*?(?:auth_appid=webview_gacha|getGachaLog|e20230424gacha|end_id=|game_biz=nap_\w+))[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^&\x00-\x20\x7f-\uffff"'<>]+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  directLogUrlRegex: /https?:\/\/(?![^\x00-\x20\x7f-\uffff"'<>]*?(?:bh3_self_help_query|hkrpg_gacha_record|getBeyondGachaLog|game_biz=(?:hk4e|hkrpg|bh3)_))(?=[^\x00-\x20\x7f-\uffff"'<>]*?(?:-nap|\/nap\/|e20230424gacha|game_biz=nap_\w+|real_gacha_type=|\/common\/gacha_record\/api\/getGachaLog))[^?\x00-\x20\x7f-\uffff"'<>]+\?(?=[^\x00-\x20\x7f-\uffff"'<>]*?(?:auth_appid=webview_gacha|getGachaLog|e20230424gacha|end_id=|game_biz=nap_\w+))[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^&\x00-\x20\x7f-\uffff"'<>]+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  cleanSearchParams(searchParams) {
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('real_gacha_type')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
  },
  formatLocalLang(localLang) {
    return localLang || ''
  }
}
