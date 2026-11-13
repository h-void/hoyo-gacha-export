const gachaTypeRaw = require('./gachaType.json')
const SUB_POOL_LABELS = require('./subPoolLabels.json')

const order = ['2000', '1000']

const VALID_UIGF_LANGS = new Set([
  'de-de',
  'en-us',
  'es-es',
  'fr-fr',
  'id-id',
  'it-it',
  'ja-jp',
  'ko-kr',
  'pt-pt',
  'ru-ru',
  'th-th',
  'tr-tr',
  'vi-vn',
  'zh-cn',
  'zh-tw'
])

const SHORT_TO_FULL_LANG = new Map([
  ['de', 'de-de'],
  ['en', 'en-us'],
  ['es', 'es-es'],
  ['fr', 'fr-fr'],
  ['id', 'id-id'],
  ['it', 'it-it'],
  ['ja', 'ja-jp'],
  ['ko', 'ko-kr'],
  ['pt', 'pt-pt'],
  ['ru', 'ru-ru'],
  ['th', 'th-th'],
  ['tr', 'tr-tr'],
  ['vi', 'vi-vn'],
  ['zh-cn', 'zh-cn'],
  ['zh-sg', 'zh-cn'],
  ['zh-tw', 'zh-tw'],
  ['zh-hk', 'zh-tw'],
  ['zh-mo', 'zh-tw'],
  ['zh-hans', 'zh-cn'],
  ['zh-hant', 'zh-tw']
])

function normalizeBeyondLang(language) {
  if (!language) return ''
  const normalized = String(language).trim().toLowerCase()
  if (SHORT_TO_FULL_LANG.has(normalized)) {
    return SHORT_TO_FULL_LANG.get(normalized)
  }
  if (VALID_UIGF_LANGS.has(normalized)) {
    return normalized
  }
  const short = normalized.split(/[-_]/)[0]
  if (SHORT_TO_FULL_LANG.has(short)) {
    return SHORT_TO_FULL_LANG.get(short)
  }
  return ''
}

function getBeyondGachaTypeMap(language = 'zh-cn') {
  const full = normalizeBeyondLang(language) || 'en-us'
  const list = gachaTypeRaw[full] || gachaTypeRaw['en-us'] || gachaTypeRaw['zh-cn']
  const map = new Map()
  order.forEach(key => {
    const found = list.find(item => item.key === key)
    if (found) map.set(found.key, found.name)
  })
  return map
}

function getSubPoolLabel(opGachaType, language = 'zh-cn') {
  const code = String(opGachaType || '')
  if (!code || code === '1000' || code === '2000') return ''
  const full = normalizeBeyondLang(language) || 'en-us'
  const table = SUB_POOL_LABELS[full] || SUB_POOL_LABELS['en-us']
  return table[code] || code
}

function normalizeBeyondPoolKey(opGachaType) {
  const code = String(opGachaType || '')
  if (code === '1000') return '1000'
  if (code === '2000' || code.startsWith('200')) return '2000'
  return code || '2000'
}

module.exports = {
  order,
  VALID_UIGF_LANGS,
  normalizeBeyondLang,
  getBeyondGachaTypeMap,
  getSubPoolLabel,
  normalizeBeyondPoolKey
}
