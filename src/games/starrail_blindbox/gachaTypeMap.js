const gachaTypeRaw = require('./gachaType.json')

const order = ['1001']

const SUB_RARITY_LABELS = {
  'zh-cn': {
    52: '隐藏款·稀有猫猫狸',
    51: '隐藏款·稀有奇美拉',
    41: '猫猫狸款',
    31: '奇美拉款'
  },
  'zh-tw': {
    52: '隱藏款·稀有貓貓狸',
    51: '隱藏款·稀有奇美拉',
    41: '貓貓狸款',
    31: '奇美拉款'
  },
  'en-us': {
    52: 'Secret · Rare Meowcat',
    51: 'Secret · Rare Chimera',
    41: 'Meowcat Edition',
    31: 'Chimera Edition'
  }
}

function normalizeBlindBoxLang(lang = 'zh-cn') {
  const s = String(lang || '').trim().toLowerCase()
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s.startsWith('zh-mo') || s.startsWith('zh-hant') || s === 'cht') {
    return 'zh-tw'
  }
  if (s.startsWith('zh') || s === 'chs') return 'zh-cn'
  if (s.startsWith('ja') || s === 'jp') return 'ja-jp'
  if (s.startsWith('ko') || s === 'kr') return 'ko-kr'
  return 'en-us'
}

function getBlindBoxGachaTypeMap(lang = 'zh-cn', detectLocaleFn) {
  const detected = detectLocaleFn ? detectLocaleFn(lang) : lang
  const full = normalizeBlindBoxLang(detected || lang)
  const list = gachaTypeRaw[full] || gachaTypeRaw['en-us'] || gachaTypeRaw['zh-cn']
  const map = new Map()
  for (const item of list) {
    map.set(item.key, item.name)
  }
  return map
}

function mapBlindBoxRarity(subRarity, fallbackRank = '3') {
  const s = String(subRarity ?? '').trim()
  if (s === '51' || s === '52' || s.startsWith('5')) return '5'
  if (s === '41' || s.startsWith('4')) return '4'
  if (s === '31' || s.startsWith('3')) return '3'
  const fb = String(fallbackRank ?? '3').trim()
  if (fb === '5' || fb === '4' || fb === '3') return fb
  return '3'
}

function getSubRarityLabel(subRarity, lang = 'zh-cn') {
  const code = String(subRarity ?? '').trim()
  if (!code) return ''
  const full = normalizeBlindBoxLang(lang)
  const table = SUB_RARITY_LABELS[full] || SUB_RARITY_LABELS['en-us']
  return table[code] || code
}

module.exports = {
  order,
  SUB_RARITY_LABELS,
  normalizeBlindBoxLang,
  getBlindBoxGachaTypeMap,
  mapBlindBoxRarity,
  getSubRarityLabel
}
