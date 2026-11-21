const gachaTypeRaw = require('./gachaType.json')
const {
  order,
  normalizeBh3Lang,
  getBh3GachaTypeMap,
  isValidBh3MenuName,
  isBareBh3CategoryMenuName,
  normalizeBh3PoolKey,
  parseBh3Content,
  parseBh3ApiRecord,
  resolveBh3Rank,
  parseBh3WikiChannelItems,
  buildBh3SyntheticId
} = require('./gachaTypeMap')

const defaultTypeMap = new Map([
  ['bh3_char_a', '角色补给A'],
  ['bh3_char_b', '角色补给B'],
  ['bh3_equip_a', '装备补给A'],
  ['bh3_equip_b', '装备补给B'],
  ['bh3_astralop', '协同补给'],
  ['bh3_outfit', '服装补给'],
  ['bh3_dorm', '家园补给']
])

const isOsHostOrBiz = (host = '', gameBiz = '') => {
  const h = String(host || '').toLowerCase()
  const b = String(gameBiz || '').toLowerCase()
  return (
    h.includes('hoyoverse.com') ||
    h.includes('webstatic-sea') ||
    h.includes('public-operation-common-sg') ||
    b.includes('global') ||
    b.includes('_os') ||
    b.includes('_usa') ||
    b.includes('_eur') ||
    b.includes('_jp') ||
    b.includes('_kr') ||
    b.includes('_tw')
  )
}

module.exports = {
  id: 'bh3',
  availability: 'active',
  fetchStrategy: 'bh3_self_help',
  uigfKey: null,
  portableJsonKey: 'bh3',
  gameBiz: 'bh3_cn',
  order,
  hiddenPoolKey: 'bh3_dorm',
  itemFormat: 'object',
  pageSize: 20,
  defaultTypeMap,
  hasCloudLog: false,
  queryParamKey: 'type',
  defaultApiDomain: 'https://public-operation-common.mihoyo.com',
  wikiChannels: ['18', '20', '19'],
  getWikiChannelUrl(channelId) {
    return `https://api-takumi-static.mihoyo.com/common/blackboard/bh3_wiki/v1/home/content/list?app_sn=bh3_wiki&channel_id=${channelId}`
  },
  getApiDomain(host = '') {
    if (isOsHostOrBiz(host)) {
      return 'https://public-operation-common-sg.hoyoverse.com'
    }
    return 'https://public-operation-common.mihoyo.com'
  },
  getRequestHeaders(domain = '') {
    const isOs = isOsHostOrBiz(domain)
    const origin = isOs ? 'https://webstatic-sea.hoyoverse.com' : 'https://webstatic.mihoyo.com'
    return {
      Origin: origin,
      Referer: `${origin}/`
    }
  },
  getDefaultPageId(domain = '', gameBiz = '') {
    return isOsHostOrBiz(domain, gameBiz) ? '6' : '5'
  },
  getMenusUrl(domain, queryString, menuType = '2') {
    return `${domain}/common/bh3_self_help_query/UserMenuQuery/GetMenus?${queryString}&type=${encodeURIComponent(menuType)}`
  },
  getValidationUrl(domain, queryString) {
    return `${domain}/common/bh3_self_help_query/UserMenuQuery/GetMenus?${queryString}&type=2`
  },
  getGachaLogUrl(domain, key, queryString) {
    return `${domain}/common/bh3_self_help_query/UserGachaQuery/GetUserGacha?${queryString}`
  },
  getGachaType(lang, detectLocaleFn) {
    return getBh3GachaTypeMap(lang, detectLocaleFn)
  },
  gachaTypeRaw,
  isValidBh3MenuName,
  isBareBh3CategoryMenuName,
  normalizeBh3PoolKey,
  parseBh3Content,
  parseBh3ApiRecord,
  resolveBh3Rank,
  parseBh3WikiChannelItems,
  buildBh3SyntheticId,
  getLogEntries(userPath, logType, appLocale) {
    const cnEntries = [
      { type: 'cn', path: `${userPath}/AppData/LocalLow/miHoYo/崩坏3/output_log.txt`, mode: 'cache', regex: /\w:\/.+BH3_Data/i },
      { type: 'cn', path: `${userPath}/AppData/LocalLow/miHoYo/崩坏3/Player.log`, mode: 'cache', regex: /\w:\/.+BH3_Data/i }
    ]
    const osEntries = [
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/Honkai Impact 3rd/output_log.txt`, mode: 'cache', regex: /\w:\/.+BH3_Data/i },
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/Honkai Impact 3rd/Player.log`, mode: 'cache', regex: /\w:\/.+BH3_Data/i },
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/Honkai Impact 3/output_log.txt`, mode: 'cache', regex: /\w:\/.+BH3_Data/i },
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/Honkai Impact 3/Player.log`, mode: 'cache', regex: /\w:\/.+BH3_Data/i },
      // HoYoPlay global BH3 installs can also log under the CN directory name
      { type: 'os', path: `${userPath}/AppData/LocalLow/miHoYo/崩坏3/output_log.txt`, mode: 'cache', regex: /\w:\/.+BH3_Data/i }
    ]
    if (logType === 1) {
      return cnEntries
    } else if (logType === 2) {
      return osEntries
    }
    if (appLocale !== 'zh-CN') {
      return [...osEntries, ...cnEntries]
    }
    return [...cnEntries, ...osEntries]
  },
  urlRegex: /https?:\/\/(?=[^\x00-\x20\x7f-\uffff"'<>]*?(?:bh3_self_help_query|csc-service-center-fe|game_biz=bh3_\w+|auth_appid=csc))[^?\x00-\x20\x7f-\uffff"'<>]+\?[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^&\x00-\x20\x7f-\uffff"'<>]+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  fallbackUrlRegex: /https?:\/\/[^?\x00-\x20\x7f-\uffff"'<>]+\?(?=[^\x00-\x20\x7f-\uffff"'<>]*?game_biz=bh3_\w+)[^\x00-\x20\x7f-\uffff"'<>]*?authkey=[^&\x00-\x20\x7f-\uffff"'<>]+[^\x00-\x20\x7f-\uffff"'<>]*/g,
  cleanSearchParams(searchParams) {
    const hostBiz = searchParams.get('game_biz') || ''
    searchParams.delete('page')
    searchParams.delete('size')
    searchParams.delete('end_id')
    if (!searchParams.get('authkey_ver')) searchParams.set('authkey_ver', '1')
    if (!searchParams.get('sign_type')) searchParams.set('sign_type', '2')
    if (!searchParams.get('auth_appid') || searchParams.get('auth_appid') === 'webview_gacha') {
      searchParams.set('auth_appid', 'csc')
    }
    if (!searchParams.get('source')) searchParams.set('source', 'service-center')
    if (!searchParams.get('source_point')) searchParams.set('source_point', 'SvcCenterSelf')
    if (!searchParams.get('win_direction')) searchParams.set('win_direction', 'portrait')
    if (!searchParams.get('game_biz')) searchParams.set('game_biz', 'bh3_cn')
    if (!searchParams.get('page_id')) {
      searchParams.set('page_id', isOsHostOrBiz('', hostBiz) ? '6' : '5')
    }
  },
  formatLocalLang(localLang) {
    return normalizeBh3Lang(localLang)
  }
}
