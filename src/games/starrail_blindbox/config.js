const gachaTypeRaw = require('./gachaType.json')
const {
  order,
  normalizeBlindBoxLang,
  getBlindBoxGachaTypeMap,
  mapBlindBoxRarity,
  getSubRarityLabel
} = require('./gachaTypeMap')

const defaultTypeMap = new Map([
  ['1001', '星际潮玩']
])

module.exports = {
  id: 'starrail_blindbox',
  availability: 'active',
  fetchStrategy: 'blindbox',
  uigfKey: null,
  portableJsonKey: 'hkrpg_blindbox',
  gameBiz: 'hkrpg_cn',
  order,
  hiddenPoolKey: null,
  itemFormat: 'object',
  pageSize: 5,
  paginationParamKey: 'max_id',
  defaultTypeMap,
  hasCloudLog: false,
  queryParamKey: 'pool_id',
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
    return `${domain}/common/hkrpg_gacha_record/api/getBlindBoxLog?${queryString}&page=1&size=5&max_id=0`
  },
  getGachaLogUrl(domain, key, queryString) {
    return `${domain}/common/hkrpg_gacha_record/api/getBlindBoxLog?${queryString}`
  },
  getFallbackUidUrls(domain, queryString) {
    return ['11', '1', '12', '2', '21', '22'].map((pool) => {
      const apiPath = ['21', '22'].includes(pool) ? 'getLdGachaLog' : 'getGachaLog'
      return `${domain}/common/hkrpg_gacha_record/api/${apiPath}?${queryString}&gacha_type=${pool}&page=1&size=5&end_id=0`
    })
  },
  getGachaType(lang, detectLocaleFn) {
    return getBlindBoxGachaTypeMap(lang, detectLocaleFn)
  },
  mapBlindBoxRarity,
  getSubRarityLabel,
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
  urlRegex: /https?:\/\/[^?\x00-\x20\x7f-\uffff"'<>]+?(?:e20260928wishrate|getBlindBoxLog)[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^&\x00-\x20\x7f-\uffff"'<>]+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  fallbackUrlRegex: /https?:\/\/[^?\x00-\x20\x7f-\uffff"'<>]+\?[^\x00-\x20\x7f-\uffff"'<>]*?auth_appid=webview_gacha[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^\x00-\x20\x7f-\uffff"'<>]*?game_biz=hkrpg_\w+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  cleanSearchParams(searchParams) {
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('gacha_type')
    searchParams.delete('end_id')
    searchParams.delete('max_id')
  },
  formatLocalLang(localLang) {
    return normalizeBlindBoxLang(localLang)
  }
}
