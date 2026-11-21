const gachaTypeRaw = require('./gachaType.json')

const order = [
  'bh3_char_a',
  'bh3_char_b',
  'bh3_equip_a',
  'bh3_equip_b',
  'bh3_astralop',
  'bh3_outfit',
  'bh3_dorm'
]

const EXCLUDED_MENU_RE = /(水晶|充值|礼包币|禮包幣|材料|消费|消費|星石|crystal|recharge|top-?up|b-?chip|material|coin|asterite)/i
const BARE_CATEGORY_RE = /^(角色|武器|圣痕|聖痕|人物|武装人偶|武裝人偶|协同者|協同者|battlesuit|character|weapon|stigma|stigmata)$/i
const SUPPLY_MENU_RE = /(补给|補給|扩充|擴充|精准|精準|家园|家園|协同|協同|人偶|服装|服裝|时装|時裝|皮肤|皮膚|服饰|服飾|增援|自选|自選|火力|进阶|進階|supply|battlesuit|equipment|astralop|elf|dorm|outfit|expansion|focused|foca|expa|adv|補給|보급)/i

const CHAR_TYPE_RE = /^(角色|女武神|装甲|裝甲|battlesuit|character|valkyrie|キャラ|캐릭터)$/i
const WEAPON_TYPE_RE = /^(武器|weapon|무기)$/i
const STIGMA_TYPE_RE = /^(圣痕|聖痕|stigma|stigmata|聖痕|성흔)$/i
const ASTRAL_ELF_OUTFIT_RE = /^(协同者|協同者|人偶|武装人偶|武裝人偶|服装|服裝|时装|時裝|皮肤|皮膚|astralop|elf|outfit|costume|コネクター|人形|衣装|협력자|무장 인형|코스튬)$/i
const MATERIAL_TYPE_RE = /^(材料|道具|消耗品|货币|貨幣|material|item|consumable|素材|재료)$/i
const FRAGMENT_NAME_RE = /(碎片|灵魂|靈魂|零件|fragment|soul|part)/i

function normalizeBh3Lang(lang = 'zh-cn') {
  const s = String(lang || '').trim().toLowerCase()
  if (s.startsWith('zh-tw') || s.startsWith('zh-hk') || s.startsWith('zh-mo') || s.startsWith('zh-hant') || s === 'cht') {
    return 'zh-tw'
  }
  if (s.startsWith('zh') || s === 'chs') return 'zh-cn'
  if (s.startsWith('ja') || s === 'jp') return 'ja-jp'
  if (s.startsWith('ko') || s === 'kr') return 'ko-kr'
  if (s.startsWith('en')) return 'en-us'
  return 'en-us'
}

function getBh3GachaTypeMap(lang = 'zh-cn', detectLocaleFn) {
  const detected = detectLocaleFn ? detectLocaleFn(lang) : lang
  const full = normalizeBh3Lang(detected || lang)
  const list = gachaTypeRaw[full] || gachaTypeRaw['en-us'] || gachaTypeRaw['zh-cn']
  const map = new Map()
  for (const item of list) {
    map.set(item.key, item.name)
  }
  return map
}

function isExcludedBh3MenuName(name = '') {
  const trimmed = String(name || '').trim()
  if (!trimmed) return true
  return EXCLUDED_MENU_RE.test(trimmed)
}

function isBareBh3CategoryMenuName(name = '') {
  const trimmed = String(name || '').trim()
  return BARE_CATEGORY_RE.test(trimmed)
}

function isValidBh3MenuName(name = '', allowBareFallback = false) {
  const trimmed = String(name || '').trim()
  if (!trimmed || isExcludedBh3MenuName(trimmed)) return false
  if (isBareBh3CategoryMenuName(trimmed)) return Boolean(allowBareFallback)
  return SUPPLY_MENU_RE.test(trimmed)
}

function normalizeBh3PoolKey(label = '', rawType = '') {
  const s = String(label || '').trim()
  const lower = s.toLowerCase()
  if (order.includes(s)) return s

  if (/家园|家園|dorm|基地|본부/i.test(s)) return 'bh3_dorm'
  if (/服装|服裝|时装|時裝|皮肤|皮膚|服饰|服飾|outfit|costume|衣装|코스튬/i.test(s)) return 'bh3_outfit'
  if (/协同|協同|人偶|astralop|elf|コネクター|협력자/i.test(s)) return 'bh3_astralop'

  if (/角色|扩充|擴充|battlesuit|expansion|キャラ|캐릭터/i.test(s)) {
    if (/[bBｂＢ]\s*$/.test(s) || /\bb\b/.test(lower) || /角色补给b|角色補給b/i.test(s)) {
      return 'bh3_char_b'
    }
    return 'bh3_char_a'
  }

  if (/装备|裝備|精准|精準|武器|圣痕|聖痕|equipment|focused|装備|장비/i.test(s)) {
    if (/[bBｂＢ]\s*$/.test(s) || /\bb\b/.test(lower) || /装备补给b|裝備補給b|精准补给b|精準補給b/i.test(s)) {
      return 'bh3_equip_b'
    }
    return 'bh3_equip_a'
  }

  const safeType = String(rawType || '').replace(/[^A-Za-z0-9_-]/g, '')
  if (safeType) return `bh3_pool_${safeType}`
  const hash = Array.from(s).reduce((acc, ch) => ((acc * 31 + ch.charCodeAt(0)) >>> 0), 7)
  return `bh3_pool_${hash}`
}

function parseBh3Content(rawContent = '') {
  const raw = String(rawContent || '').trim()
  if (!raw) {
    return { itemType: '', name: '', rawContent: '' }
  }
  const m = raw.match(/^(?:\[([^\]]+)\]|【([^】]+)】)\s*(.+)$/)
  if (!m) {
    return { itemType: '', name: raw, rawContent: raw }
  }
  const itemType = (m[1] || m[2] || '').trim()
  let name = (m[3] || '').trim()
  if (CHAR_TYPE_RE.test(itemType)) {
    name = name.replace(/(?:角色卡|Character Card)$/i, '').trim()
  }
  return { itemType, name: name || raw, rawContent: raw }
}

function parseBh3ApiRecord(entry) {
  if (!entry || typeof entry !== 'object') return null

  if (Array.isArray(entry.item)) {
    let time = ''
    let rawContent = ''
    for (const field of entry.item) {
      if (!field || typeof field !== 'object') continue
      const label = String(field.label || field.name || '').trim()
      const value = String(field.value || '').trim()
      if (!time && (/时间|時間|time|date|日時|시간/i.test(label) || /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(value))) {
        time = value
      } else if (!rawContent && /内容|內容|物品|道具|content|item|reward|아이템/i.test(label)) {
        rawContent = value
      }
    }
    if (!time && entry.item[0]?.value) time = String(entry.item[0].value).trim()
    if (!rawContent && entry.item[1]?.value) rawContent = String(entry.item[1].value).trim()
    if (!time && !rawContent) return null
    const parsed = parseBh3Content(rawContent)
    return {
      time,
      name: parsed.name,
      item_type: parsed.itemType,
      raw_content: parsed.rawContent
    }
  }

  const time = String(entry.time || entry.gacha_time || '').trim()
  const rawContent = String(entry.raw_content || entry.content || '').trim()
  if (rawContent) {
    const parsed = parseBh3Content(rawContent)
    return {
      time,
      name: entry.name || parsed.name,
      item_type: entry.item_type || entry.itemType || parsed.itemType,
      raw_content: rawContent,
      rank_type: entry.rank_type != null ? String(entry.rank_type) : (entry.rank != null ? String(entry.rank) : '')
    }
  }
  if (entry.name) {
    return {
      time,
      name: String(entry.name).trim(),
      item_type: String(entry.item_type || entry.itemType || '').trim(),
      raw_content: entry.item_type ? `[${entry.item_type}]${entry.name}` : String(entry.name).trim(),
      rank_type: entry.rank_type != null ? String(entry.rank_type) : (entry.rank != null ? String(entry.rank) : '')
    }
  }
  return null
}

function normalizeLookupName(name = '') {
  return String(name || '').trim().replace(/\s+/g, '')
}

function resolveBh3Rank(itemType = '', name = '', wikiRankMap = null) {
  const typeStr = String(itemType || '').trim()
  const nameStr = String(name || '').trim()
  const lookupKey = normalizeLookupName(nameStr)

  if (MATERIAL_TYPE_RE.test(typeStr)) {
    return '3'
  }
  if (ASTRAL_ELF_OUTFIT_RE.test(typeStr)) {
    if (FRAGMENT_NAME_RE.test(nameStr)) {
      return '4'
    }
    return '5'
  }
  if (CHAR_TYPE_RE.test(typeStr)) {
    if (FRAGMENT_NAME_RE.test(nameStr)) {
      return '4'
    }
    const charMap = wikiRankMap?.characters || {}
    const wikiRank = charMap[nameStr] || charMap[lookupKey]
    if (wikiRank) {
      if (wikiRank === '5' || /^S/i.test(wikiRank)) return '5'
      if (wikiRank === '4' || /^(A|SP)/i.test(wikiRank)) return '4'
      if (wikiRank === '3' || /^B/i.test(wikiRank)) return '3'
    }
    return '4'
  }
  if (WEAPON_TYPE_RE.test(typeStr)) {
    const weaponMap = wikiRankMap?.weapons || {}
    const wikiRank = weaponMap[nameStr] || weaponMap[lookupKey]
    if (wikiRank === '5' || wikiRank === '4' || wikiRank === '3') {
      return wikiRank
    }
    return '4'
  }
  if (STIGMA_TYPE_RE.test(typeStr)) {
    return '4'
  }
  return '3'
}

function parseBh3WikiChannelItems(channelId, responseJson) {
  const map = {}
  const groups = responseJson?.data?.list
  if (!Array.isArray(groups)) return map

  const cid = String(channelId)
  const extKey = `c_${cid}`

  for (const group of groups) {
    const items = Array.isArray(group?.list) ? group.list : (group?.title ? [group] : [])
    for (const item of items) {
      const title = String(item?.title || '').trim()
      if (!title) continue

      let extObj = item.ext
      if (typeof extObj === 'string') {
        try {
          extObj = JSON.parse(extObj)
        } catch (e) {
          extObj = null
        }
      }
      const filterTexts = []
      const rawFilter = extObj?.[extKey]?.filter?.text || extObj?.filter?.text
      if (Array.isArray(rawFilter)) {
        filterTexts.push(...rawFilter.map(v => String(v)))
      } else if (typeof rawFilter === 'string') {
        try {
          const parsed = JSON.parse(rawFilter)
          if (Array.isArray(parsed)) filterTexts.push(...parsed.map(v => String(v)))
        } catch (e) {
          filterTexts.push(rawFilter)
        }
      }

      if (cid === '18') {
        let rank = ''
        for (const tag of filterTexts) {
          if (/初始(?:阶级|评级|品级)\s*\/\s*S\b/i.test(tag) || /^S级?$/i.test(tag)) {
            rank = '5'
            break
          }
          if (/初始(?:阶级|评级|品级)\s*\/\s*(?:A|SP)\b/i.test(tag) || /^(?:A|SP)级?$/i.test(tag)) {
            rank = '4'
            break
          }
          if (/初始(?:阶级|评级|品级)\s*\/\s*B\b/i.test(tag) || /^B级?$/i.test(tag)) {
            rank = '3'
            break
          }
        }
        if (rank) {
          map[title] = rank
          map[normalizeLookupName(title)] = rank
        }
      } else if (cid === '20') {
        let rank = ''
        for (const tag of filterTexts) {
          if (/五星|5星|5-?star/i.test(tag)) {
            rank = '5'
            break
          }
          if (/四星|4星|4-?star/i.test(tag)) {
            rank = '4'
            break
          }
          if (/三星|3星|3-?star/i.test(tag)) {
            rank = '3'
            break
          }
        }
        if (rank) {
          map[title] = rank
          map[normalizeLookupName(title)] = rank
        }
      } else if (cid === '19') {
        map[title] = '4'
        map[normalizeLookupName(title)] = '4'
      }
    }
  }
  return map
}

function buildBh3SyntheticId(timeStr, poolKey = 'bh3_char_a', seqInSecond = 1) {
  const parsed = Date.parse(String(timeStr || '').replace(' ', 'T') + 'Z')
  const sec = Number.isNaN(parsed) ? 1700000000 : Math.floor(parsed / 1000)
  let poolNum = order.indexOf(poolKey) + 1
  if (poolNum <= 0) {
    poolNum = 100 + (Array.from(String(poolKey)).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 899, 0))
  }
  const poolPart = String(poolNum).padStart(4, '0')
  const seqPart = String(Math.max(1, seqInSecond) % 10000).padStart(4, '0')
  return `${sec}${poolPart}${seqPart}`
}

module.exports = {
  order,
  normalizeBh3Lang,
  getBh3GachaTypeMap,
  isExcludedBh3MenuName,
  isBareBh3CategoryMenuName,
  isValidBh3MenuName,
  normalizeBh3PoolKey,
  parseBh3Content,
  parseBh3ApiRecord,
  resolveBh3Rank,
  parseBh3WikiChannelItems,
  buildBh3SyntheticId
}
