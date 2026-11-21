function normalizePendingLang(lang = 'zh-cn') {
  const s = String(lang || '').trim().toLowerCase()
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s.startsWith('zh-mo') || s.startsWith('zh-hant') || s === 'cht') {
    return 'zh-tw'
  }
  if (s.startsWith('zh') || s === 'chs') return 'zh-cn'
  return 'en-us'
}

function createPendingAdapter({
  id,
  gameBiz,
  portableJsonKey,
  order,
  gachaTypeRaw,
  statusTag,
  platformHint,
  releaseHint
}) {
  const defaultList = gachaTypeRaw['zh-cn'] || []
  const defaultTypeMap = new Map(defaultList.map(item => [item.key, item.name]))

  function getGachaType(lang = 'zh-cn', detectLocaleFn) {
    const detected = detectLocaleFn ? detectLocaleFn(lang) : lang
    const full = normalizePendingLang(detected || lang)
    const list = gachaTypeRaw[full] || gachaTypeRaw['en-us'] || gachaTypeRaw['zh-cn'] || []
    const map = new Map()
    for (const item of list) {
      map.set(item.key, item.name)
    }
    return map
  }

  return {
    id,
    availability: 'pending',
    fetchStrategy: 'pending',
    uigfKey: null,
    portableJsonKey,
    gameBiz,
    statusTag,
    platformHint,
    releaseHint: releaseHint || '',
    order,
    hiddenPoolKey: null,
    itemFormat: 'object',
    defaultTypeMap,
    hasCloudLog: false,
    queryParamKey: 'gacha_type',
    defaultApiDomain: '',
    getApiDomain() {
      return ''
    },
    getValidationUrl() {
      return ''
    },
    getGachaLogUrl() {
      return ''
    },
    getGachaType,
    gachaTypeRaw,
    getLogEntries() {
      return []
    },
    urlRegex: null,
    cleanSearchParams() {},
    formatLocalLang(localLang) {
      return normalizePendingLang(localLang)
    }
  }
}

module.exports = {
  createPendingAdapter,
  normalizePendingLang
}
