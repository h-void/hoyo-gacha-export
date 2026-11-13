const genshinConfig = require('./genshin/config')
const starrailConfig = require('./starrail/config')
const zzzConfig = require('./zzz/config')
const beyondConfig = require('./beyond/config')

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
  zzz: {
    'zh-cn': require('./zzz/i18n/简体中文.json'),
    'zh-tw': require('./zzz/i18n/繁體中文.json'),
    'en-us': require('./zzz/i18n/English.json')
  },
  beyond: {
    'zh-cn': require('./beyond/i18n/简体中文.json'),
    'zh-tw': require('./beyond/i18n/繁體中文.json'),
    'en-us': require('./beyond/i18n/English.json')
  }
}

const GAME_IDS = ['genshin', 'starrail', 'zzz', 'beyond']

const GAMES = {
  genshin: genshinConfig,
  starrail: starrailConfig,
  zzz: zzzConfig,
  beyond: beyondConfig
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

function getGameAdapter(gameId = 'genshin') {
  return GAMES[gameId] || GAMES.genshin
}

const BEYOND_TYPE_HINT_RE = /(装扮套装|裝扮套裝|装扮部件|裝扮部件|装扮形录|裝扮形錄|互动动作|互動動作|互动表情|互動表情|Cosmetic Set|Cosmetic Component|Cosmetic Catalog|Interactive Actions?|Interactive Expressions?|颂愿|頌願|星願|축원|\bOdes?\b|Ода|ภาวนา|Ca Tụng)/i
const ZZZ_TYPE_HINT_RE = /(音擎|代理人|邦布|Bangboo|W-Engine|Agent|エージェント|ボンプ|音動機|에이전트|W-엔진|独家|频段|調頻|调频|Channel)/i
const HSR_TYPE_HINT_RE = /(光锥|光錐|Light Cone|Lichtkegel|Cono|cône|光円錐|광추|跃迁|躍遷|Warp|Jump|Saut|Salto|Прыжок|跳躍|워프|Bước Nhảy)/i
const GENSHIN_TYPE_HINT_RE = /(祈愿|祈願|Wish|Gebet|Gachapón|Vœux|Oração|Молитва|기원|อธิษฐาน|Cầu Nguyện|Permohonan)/i

function detectDataGame(data) {
  if (!data || !data.result) return null
  const resultEntries = data.result instanceof Map
    ? Array.from(data.result.entries())
    : Array.isArray(data.result)
      ? data.result
      : Object.entries(data.result)

  // Check item shape and pool keys
  for (const [key, list] of resultEntries) {
    if (Array.isArray(list) && list.length > 0 && Array.isArray(list[0])) {
      return 'genshin'
    }
    if (['1000', '2000', '20011', '20012', '20021', '20022'].includes(String(key))) {
      return 'beyond'
    }
    if (['301', '302', '200', '400', '500', '100'].includes(String(key))) {
      return 'genshin'
    }
    if (['11', '12', '21', '22'].includes(String(key))) {
      return 'starrail'
    }
    if (['3', '5', '102', '103'].includes(String(key))) {
      return 'zzz'
    }
  }

  // Inspect items for Beyond fields first (Beyond also has rank_type === '2'), then ZZZ/HSR
  for (const [, list] of resultEntries) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (Array.isArray(item)) return 'genshin'
      if (item && typeof item === 'object') {
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
    if (BEYOND_TYPE_HINT_RE.test(joined)) return 'beyond'
    if (GENSHIN_TYPE_HINT_RE.test(joined)) return 'genshin'
    if (ZZZ_TYPE_HINT_RE.test(joined)) return 'zzz'
    if (HSR_TYPE_HINT_RE.test(joined)) return 'starrail'
  }

  return null
}

module.exports = {
  GAME_IDS,
  GAMES,
  ID_JSON,
  UIGF_KEY_TO_GAME,
  GAME_TO_UIGF_KEY,
  gameI18n,
  getGameAdapter,
  detectDataGame
}
