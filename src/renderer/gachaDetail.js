import { isWeapon, isCharacter, isBangboo } from './utils'

const GAME_POOL_ORDER = {
  genshin: ['301', '302', '500', '200', '100'],
  starrail: ['11', '12', '21', '22', '1', '2'],
  zzz: ['2', '3', '5', '102', '103', '1'],
  beyond: ['2000', '1000']
}

const itemCount = (map, name) => {
  if (!map.has(name)) {
    map.set(name, 1)
  } else {
    map.set(name, map.get(name) + 1)
  }
}

const getOrderKeys = (data, game) => {
  const baseOrder = GAME_POOL_ORDER[game] || []
  const keys = []
  for (const k of baseOrder) {
    if (data.has(k)) keys.push(k)
  }
  for (const k of data.keys()) {
    if (!keys.includes(k)) keys.push(k)
  }
  return keys
}

const gachaDetail = (data, game = 'genshin') => {
  if (!data) return
  const detailMap = new Map()
  const isZzz = game === 'zzz'
  const isBeyond = game === 'beyond'
  const keys = getOrderKeys(data, game)

  for (const key of keys) {
    const value = data.get(key)
    if (!Array.isArray(value) || !value.length) continue

    const detail = isZzz
      ? {
          count2: 0, count3: 0, count4: 0,
          count2w: 0, count3w: 0, count4w: 0, count3c: 0, count4c: 0, count3b: 0, count4b: 0,
          weapon2: new Map(), weapon3: new Map(), weapon4: new Map(),
          char3: new Map(), char4: new Map(),
          bang3: new Map(), bang4: new Map(),
          date: [],
          ssrPos: [], countMio: 0, total: value.length
        }
      : isBeyond
        ? {
            count2: 0, count3: 0, count4: 0, count5: 0,
            typeMap2: new Map(), typeMap3: new Map(), typeMap4: new Map(), typeMap5: new Map(),
            date: [],
            ssrPos: [], countMio: 0, total: value.length
          }
        : {
            count3: 0, count4: 0, count5: 0,
            count3w: 0, count4w: 0, count5w: 0, count4c: 0, count5c: 0,
            weapon3: new Map(), weapon4: new Map(), weapon5: new Map(),
            char4: new Map(), char5: new Map(),
            date: [],
            ssrPos: [], countMio: 0, total: value.length
          }

    let lastSSR = 0
    let dateMin = 0
    let dateMax = 0
    const beyondTargetRank = String(key) === '1000' ? 4 : 5

    value.forEach((item, index) => {
      let time, name, type, rank, wishType
      if (Array.isArray(item)) {
        [time, name, type, rank, wishType] = item
      } else {
        time = item.time
        name = item.item_name ?? item.name
        type = item.item_type
        rank = item.rank_type
        wishType = item.op_gacha_type || item.gacha_type || key
      }

      const rankNum = parseInt(rank, 10)
      const timestamp = new Date(time).getTime()
      if (!Number.isNaN(timestamp)) {
        if (!dateMin || dateMin > timestamp) dateMin = timestamp
        if (!dateMax || dateMax < timestamp) dateMax = timestamp
      }

      if (isZzz) {
        if (rankNum === 2) {
          detail.count2++
          detail.countMio++
          if (isWeapon(type)) {
            detail.count2w++
            itemCount(detail.weapon2, name)
          }
        } else if (rankNum === 3) {
          detail.count3++
          detail.countMio++
          if (isWeapon(type)) {
            detail.count3w++
            itemCount(detail.weapon3, name)
          } else if (isBangboo(type)) {
            detail.count3b++
            itemCount(detail.bang3, name)
          } else if (isCharacter(type)) {
            detail.count3c++
            itemCount(detail.char3, name)
          }
        } else if (rankNum === 4) {
          detail.ssrPos.push([name, index + 1 - lastSSR, time, key])
          lastSSR = index + 1
          detail.count4++
          detail.countMio = 0
          if (isWeapon(type)) {
            detail.count4w++
            itemCount(detail.weapon4, name)
          } else if (isBangboo(type)) {
            detail.count4b++
            itemCount(detail.bang4, name)
          } else if (isCharacter(type)) {
            detail.count4c++
            itemCount(detail.char4, name)
          }
        }
      } else if (isBeyond) {
        const typeLabel = type || '-'
        if (rankNum === 2) {
          detail.count2++
          itemCount(detail.typeMap2, typeLabel)
        } else if (rankNum === 3) {
          detail.count3++
          itemCount(detail.typeMap3, typeLabel)
        } else if (rankNum === 4) {
          detail.count4++
          itemCount(detail.typeMap4, typeLabel)
        } else if (rankNum === 5) {
          detail.count5++
          itemCount(detail.typeMap5, typeLabel)
        }
        if (rankNum === beyondTargetRank) {
          detail.ssrPos.push([name, index + 1 - lastSSR, time, wishType || key])
          lastSSR = index + 1
          detail.countMio = 0
        } else {
          detail.countMio++
        }
      } else {
        if (rankNum === 3) {
          detail.count3++
          detail.countMio++
          if (isWeapon(type)) {
            detail.count3w++
            itemCount(detail.weapon3, name)
          }
        } else if (rankNum === 4) {
          detail.count4++
          detail.countMio++
          if (isWeapon(type)) {
            detail.count4w++
            itemCount(detail.weapon4, name)
          } else if (isCharacter(type)) {
            detail.count4c++
            itemCount(detail.char4, name)
          }
        } else if (rankNum === 5) {
          detail.ssrPos.push([name, index + 1 - lastSSR, time, wishType || key])
          lastSSR = index + 1
          detail.count5++
          detail.countMio = 0
          if (isWeapon(type)) {
            detail.count5w++
            itemCount(detail.weapon5, name)
          } else if (isCharacter(type)) {
            detail.count5c++
            itemCount(detail.char5, name)
          }
        }
      }
    })

    detail.date = [dateMin, dateMax]
    if (detail.total) {
      detailMap.set(key, detail)
    }
  }

  return detailMap
}

export { GAME_POOL_ORDER }
export default gachaDetail
