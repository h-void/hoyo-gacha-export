const genshinConfig = require('./genshin/config')
const beyondConfig = require('./beyond/config')
const starrailConfig = require('./starrail/config')
const starrailBlindboxConfig = require('./starrail_blindbox/config')
const zzzConfig = require('./zzz/config')
const bh3Config = require('./bh3/config')
const petitplanetConfig = require('./petitplanet/config')
const nexusanimaConfig = require('./nexusanima/config')

const starrailIdJson = require('./starrail/idJson.json')
const zzzIdJson = require('./zzz/idJson.json')

// Static i18n requires for Rollup CommonJS bundler compatibility
const gameI18n = {
  genshin: {
    'zh-cn': require('./genshin/i18n/简体中文.json'),
    'zh-tw': require('./genshin/i18n/繁體中文.json'),
    'de-de': require('./genshin/i18n/Deutsch.json'),
    'en-us': require('./genshin/i18n/English.json'),
    'es-es': require('./genshin/i18n/Español.json'),
    'fr-fr': require('./genshin/i18n/Français.json'),
    'id-id': require('./genshin/i18n/Indonesia.json'),
    'ja-jp': require('./genshin/i18n/日本語.json'),
    'ko-kr': require('./genshin/i18n/한국어.json'),
    'pt-pt': require('./genshin/i18n/Português.json'),
    'ru-ru': require('./genshin/i18n/Pусский.json'),
    'th-th': require('./genshin/i18n/ภาษาไทย.json'),
    'vi-vn': require('./genshin/i18n/Tiếng Việt.json')
  },
  beyond: {
    'zh-cn': require('./beyond/i18n/简体中文.json'),
    'zh-tw': require('./beyond/i18n/繁體中文.json'),
    'en-us': require('./beyond/i18n/English.json')
  },
  starrail: {
    'zh-cn': require('./starrail/i18n/简体中文.json'),
    'zh-tw': require('./starrail/i18n/繁體中文.json'),
    'de-de': require('./starrail/i18n/Deutsch.json'),
    'en-us': require('./starrail/i18n/English.json'),
    'es-es': require('./starrail/i18n/Español.json'),
    'fr-fr': require('./starrail/i18n/Français.json'),
    'id-id': require('./starrail/i18n/Indonesia.json'),
    'ja-jp': require('./starrail/i18n/日本語.json'),
    'ko-kr': require('./starrail/i18n/한국어.json'),
    'pt-pt': require('./starrail/i18n/Português.json'),
    'ru-ru': require('./starrail/i18n/Pусский.json'),
    'th-th': require('./starrail/i18n/ภาษาไทย.json'),
    'vi-vn': require('./starrail/i18n/Tiếng Việt.json')
  },
  starrail_blindbox: {
    'zh-cn': require('./starrail_blindbox/i18n/简体中文.json'),
    'zh-tw': require('./starrail_blindbox/i18n/繁體中文.json'),
    'en-us': require('./starrail_blindbox/i18n/English.json')
  },
  zzz: {
    'zh-cn': require('./zzz/i18n/简体中文.json'),
    'zh-tw': require('./zzz/i18n/繁體中文.json'),
    'en-us': require('./zzz/i18n/English.json')
  },
  bh3: {
    'zh-cn': require('./bh3/i18n/简体中文.json'),
    'zh-tw': require('./bh3/i18n/繁體中文.json'),
    'en-us': require('./bh3/i18n/English.json')
  },
  petitplanet: {
    'zh-cn': require('./petitplanet/i18n/简体中文.json'),
    'zh-tw': require('./petitplanet/i18n/繁體中文.json'),
    'en-us': require('./petitplanet/i18n/English.json')
  },
  nexusanima: {
    'zh-cn': require('./nexusanima/i18n/简体中文.json'),
    'zh-tw': require('./nexusanima/i18n/繁體中文.json'),
    'en-us': require('./nexusanima/i18n/English.json')
  }
}

const GAME_CATALOG = require('./catalog.json')

const ACTIVE_GAME_IDS = ['genshin', 'beyond', 'starrail', 'starrail_blindbox', 'zzz', 'bh3']
const PENDING_GAME_IDS = ['petitplanet', 'nexusanima']
const UIGF_GAME_IDS = ['genshin', 'starrail', 'zzz', 'beyond']
const GAME_IDS = [...ACTIVE_GAME_IDS, ...PENDING_GAME_IDS]

const PARENT_GAME_IDS = GAME_CATALOG.map(entry => entry.id)
const ADAPTER_TO_PARENT_GAME = {}
const ADAPTER_TO_MODE_KEY = {}
for (const entry of GAME_CATALOG) {
  for (const mode of entry.modes) {
    ADAPTER_TO_PARENT_GAME[mode.id] = entry.id
    ADAPTER_TO_MODE_KEY[mode.id] = mode.modeKey
  }
}

function getParentGame(adapterId = 'genshin') {
  const parentId = ADAPTER_TO_PARENT_GAME[adapterId] || 'genshin'
  return GAME_CATALOG.find(entry => entry.id === parentId) || GAME_CATALOG[0]
}

function getGameModes(parentOrAdapterId = 'genshin') {
  const entry = GAME_CATALOG.find(g => g.id === parentOrAdapterId) || getParentGame(parentOrAdapterId)
  return entry ? entry.modes : []
}

const GAMES = {
  genshin: genshinConfig,
  beyond: beyondConfig,
  starrail: starrailConfig,
  starrail_blindbox: starrailBlindboxConfig,
  zzz: zzzConfig,
  bh3: bh3Config,
  petitplanet: petitplanetConfig,
  nexusanima: nexusanimaConfig
}

const ID_JSON = {
  starrail: starrailIdJson,
  zzz: zzzIdJson
}

const UIGF_KEY_TO_GAME = {
  hk4e: 'genshin',
  hkrpg: 'starrail',
  nap: 'zzz',
  hk4e_ugc: 'beyond'
}

const GAME_TO_UIGF_KEY = {
  genshin: 'hk4e',
  starrail: 'hkrpg',
  zzz: 'nap',
  beyond: 'hk4e_ugc'
}

const PORTABLE_KEY_TO_GAME = {
  bh3: 'bh3',
  bh3_cn: 'bh3',
  bh3_global: 'bh3',
  bh3_os: 'bh3',
  hkrpg_blindbox: 'starrail_blindbox',
  starrail_blindbox: 'starrail_blindbox',
  hyg: 'petitplanet',
  hyg_cn: 'petitplanet',
  petitplanet: 'petitplanet',
  hna: 'nexusanima',
  hna_cn: 'nexusanima',
  nexusanima: 'nexusanima'
}

const GAME_TO_PORTABLE_KEY = {
  bh3: 'bh3',
  starrail_blindbox: 'hkrpg_blindbox',
  petitplanet: 'hyg',
  nexusanima: 'hna'
}

function getGameAdapter(gameId = 'genshin') {
  return GAMES[gameId] || GAMES.genshin
}

const BLINDBOX_TYPE_HINT_RE = /(星际潮玩|星際潮玩|Interstellar Collectibles|奇美拉|猫猫狸|貓貓狸|星間トレンドトイ|성간 트렌드 토이)/i
const BH3_TYPE_HINT_RE = /(圣痕|聖痕|协同者|協同者|武装人偶|武裝人偶|角色补给|角色補給|装备补给|裝備補給|家园补给|家園補給|协同补给|協同補給|服装补给|服裝補給|扩充补给|精准补给|Battlesuit Supply|Equipment Supply|AstralOp|Dorm Supply|Outfit Supply|Stigmata?)/i
const BEYOND_TYPE_HINT_RE = /(装扮套装|裝扮套裝|装扮部件|裝扮部件|装扮形录|裝扮形錄|互动动作|互動動作|互动表情|互動表情|Cosmetic Set|Cosmetic Component|Cosmetic Catalog|Interactive Actions?|Interactive Expressions?|颂愿|頌願|星願|축원|\bOdes?\b|Ода|ภาวนา|Ca Tụng)/i
const ZZZ_TYPE_HINT_RE = /(音擎|代理人|邦布|Bangboo|W-Engine|Agent|エージェント|ボンプ|音動機|에이전트|W-엔진|独家|频段|調頻|调频|Channel)/i
const HSR_TYPE_HINT_RE = /(光锥|光錐|Light Cone|Lichtkegel|Cono|cône|光円錐|광추|跃迁|躍遷|Warp|Jump|Saut|Salto|Прыжок|跳躍|워프|Bước Nhảy)/i
const GENSHIN_TYPE_HINT_RE = /(祈愿|祈願|Wish|Gebet|Gachapón|Vœux|Oração|Молитва|기원|อธิษฐาน|Cầu Nguyện|Permohonan)/i

function detectDataGame(data) {
  if (!data || !data.result) return null
  if (data.game && GAME_IDS.includes(data.game)) {
    return data.game
  }

  const resultEntries = data.result instanceof Map
    ? Array.from(data.result.entries())
    : Array.isArray(data.result)
      ? data.result
      : Object.entries(data.result)

  // Check explicit prefixed keys and game-specific pool keys
  for (const [key, list] of resultEntries) {
    const keyStr = String(key)
    if (Array.isArray(list) && list.length > 0 && Array.isArray(list[0])) {
      return 'genshin'
    }
    if (keyStr.startsWith('bh3_')) return 'bh3'
    if (keyStr.startsWith('hyg_')) return 'petitplanet'
    if (keyStr.startsWith('hna_')) return 'nexusanima'
    if (keyStr === '1001') return 'starrail_blindbox'
    if (['1000', '2000', '20011', '20012', '20021', '20022'].includes(keyStr)) {
      return 'beyond'
    }
    if (['301', '302', '200', '400', '500', '100'].includes(keyStr)) {
      return 'genshin'
    }
    if (['11', '12', '21', '22'].includes(keyStr)) {
      return 'starrail'
    }
    if (['3', '5', '102', '103'].includes(keyStr)) {
      return 'zzz'
    }
  }

  // Inspect item payloads (order matters: BlindBox & BH3 before Beyond/ZZZ/HSR)
  for (const [, list] of resultEntries) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (Array.isArray(item)) return 'genshin'
      if (item && typeof item === 'object') {
        if ('blind_box_sub_rarity' in item || 'pet_id' in item || 'chroma_appearance_id' in item || 'pool_id' in item) {
          return 'starrail_blindbox'
        }
        if ('raw_content' in item) return 'bh3'
        if (item.item_type && BH3_TYPE_HINT_RE.test(item.item_type)) return 'bh3'
        if ('op_gacha_type' in item || 'schedule_id' in item || 'item_name' in item) return 'beyond'
        if (item.item_type && BEYOND_TYPE_HINT_RE.test(item.item_type)) return 'beyond'
        if (String(item.rank_type) === '2') return 'zzz'
        if (item.item_type && ZZZ_TYPE_HINT_RE.test(item.item_type)) return 'zzz'
        if (item.item_type && HSR_TYPE_HINT_RE.test(item.item_type)) return 'starrail'
      }
    }
  }

  // Inspect typeMap strings as final tiebreaker
  if (data.typeMap) {
    const typeEntries = data.typeMap instanceof Map
      ? Array.from(data.typeMap.entries())
      : Array.isArray(data.typeMap)
        ? data.typeMap
        : Object.entries(data.typeMap)
    const joined = typeEntries.map(([, v]) => v || '').join(' ')
    if (BLINDBOX_TYPE_HINT_RE.test(joined)) return 'starrail_blindbox'
    if (BH3_TYPE_HINT_RE.test(joined)) return 'bh3'
    if (BEYOND_TYPE_HINT_RE.test(joined)) return 'beyond'
    if (GENSHIN_TYPE_HINT_RE.test(joined)) return 'genshin'
    if (ZZZ_TYPE_HINT_RE.test(joined)) return 'zzz'
    if (HSR_TYPE_HINT_RE.test(joined)) return 'starrail'
  }

  return null
}

module.exports = {
  GAME_CATALOG,
  PARENT_GAME_IDS,
  ADAPTER_TO_PARENT_GAME,
  ADAPTER_TO_MODE_KEY,
  GAME_IDS,
  ACTIVE_GAME_IDS,
  PENDING_GAME_IDS,
  UIGF_GAME_IDS,
  GAMES,
  ID_JSON,
  UIGF_KEY_TO_GAME,
  GAME_TO_UIGF_KEY,
  PORTABLE_KEY_TO_GAME,
  GAME_TO_PORTABLE_KEY,
  gameI18n,
  getGameAdapter,
  getParentGame,
  getGameModes,
  detectDataGame
}
