const gachaTypeRaw = require('./gachaType.json')

const order = ['11', '12', '21', '22', '1', '2']

const defaultTypeMap = new Map([
  ['11', '角色活动跃迁'],
  ['12', '光锥活动跃迁'],
  ['21', '角色联动跃迁'],
  ['22', '光锥联动跃迁'],
  ['1', '常驻跃迁'],
  ['2', '新手跃迁']
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
  id: 'starrail',
  uigfKey: 'hkrpg',
  order,
  hiddenPoolKey: '2',
  itemFormat: 'object',
  defaultTypeMap,
  hasCloudLog: false,
  queryParamKey: 'gacha_type',
  defaultApiDomain: 'https://public-operation-hkrpg.mihoyo.com',
  getApiDomain(host = '') {
    if (
      host.includes('webstatic-sea') ||
      host.includes('hkrpg-api-os') ||
      host.includes('api-os-takumi') ||
      host.includes('hoyoverse.com')
    ) {
      return 'https://public-operation-hkrpg-sg.hoyoverse.com'
    }
    return 'https://public-operation-hkrpg.mihoyo.com'
  },
  getValidationUrl(domain, queryString) {
    return `${domain}/common/hkrpg_gacha_record/api/getGachaLog?${queryString}&page=1&size=5&gacha_type=1&end_id=0`
  },
  getGachaLogUrl(domain, key, queryString) {
    const gachaURLPath = ['21', '22'].includes(key) ? 'getLdGachaLog' : 'getGachaLog'
    return `${domain}/common/hkrpg_gacha_record/api/${gachaURLPath}?${queryString}`
  },
  getGachaType,
  gachaTypeRaw,
  getLogEntries(userPath, logType, appLocale) {
    const entries = [
      { type: 'cn', path: `${userPath}/AppData/LocalLow/miHoYo/崩坏：星穹铁道/Player.log`, mode: 'cache', regex: /\w:\/.*?\/StarRail_Data\//i },
      { type: 'os', path: `${userPath}/AppData/LocalLow/Cognosphere/Star Rail/Player.log`, mode: 'cache', regex: /\w:\/.*?\/StarRail_Data\//i }
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
  urlRegex: /https[^?]+?\?[^?]+?&auth_appid=webview_gacha&.+?authkey=.+?&game_biz=hkrpg_/g,
  cleanSearchParams(searchParams) {
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
  },
  formatLocalLang(localLang) {
    return localLang || ''
  }
}
