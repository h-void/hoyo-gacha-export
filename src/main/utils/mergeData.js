const getRecordId = (item) => {
  if (!item) return ''
  if (Array.isArray(item)) {
    return item[5] ? String(item[5]) : ''
  }
  return item.id ? String(item.id) : ''
}

const compareTupleList = (b, a) => {
  if (!b.length) return false
  if (b.length < a.length) {
    a = a.slice(0, b.length)
  }
  const strA = a.map(item => item.slice(0, 4).join('-')).join(',')
  const strB = b.map(item => item.slice(0, 4).join('-')).join(',')
  return strA === strB
}

const mergeTupleOverlap = (oldList, newList) => {
  const minNew = new Date(newList[0][0]).getTime()
  const firstNewId = newList[0][5]
  let pos = oldList.length
  let idFounded = false
  for (let i = oldList.length - 1; i >= 0; i--) {
    const oldId = oldList[i][5]
    if (oldId && firstNewId && oldId === firstNewId) {
      pos = i
      idFounded = true
      break
    }
  }
  if (!idFounded) {
    const width = Math.min(11, newList.length, oldList.length)
    for (let i = 0; i < oldList.length; i++) {
      const time = new Date(oldList[i][0]).getTime()
      if (time >= minNew) {
        if (compareTupleList(oldList.slice(i, width + i), newList.slice(0, width))) {
          pos = i
          break
        }
      }
    }
  }
  return oldList.slice(0, pos).concat(newList)
}

/**
 * Merge two chronological lists (old/local list `a`, new/origin list `b`).
 * Uses BigInt ID deduplication & sorting when all items have numeric IDs,
 * and falls back to Genshin timestamp/tuple overlap matching if IDs are absent.
 */
const mergeList = (a, b) => {
  if (!a || !a.length) return b || []
  if (!b || !b.length) return a

  const combined = [...b, ...a]
  const allHaveNumericId = combined.every(item => /^\d+$/.test(getRecordId(item)))

  if (!allHaveNumericId && (Array.isArray(a[0]) || Array.isArray(b[0]))) {
    return mergeTupleOverlap(a, b)
  }

  const result = []
  const idSet = new Set()
  combined.forEach(item => {
    const id = getRecordId(item)
    if (!id || !idSet.has(id)) {
      result.push(item)
    }
    if (id) {
      idSet.add(id)
    }
  })

  return result.sort((m, n) => {
    const idM = getRecordId(m)
    const idN = getRecordId(n)
    if (idM && idN && /^\d+$/.test(idM) && /^\d+$/.test(idN)) {
      const diff = BigInt(idM) - BigInt(idN)
      if (diff > 0n) return 1
      if (diff < 0n) return -1
      return 0
    }
    const timeM = Array.isArray(m) ? m[0] : m.time
    const timeN = Array.isArray(n) ? n[0] : n.time
    return new Date(timeM).getTime() - new Date(timeN).getTime()
  })
}

const { buildBh3SyntheticId } = require('../../games/bh3/gachaTypeMap')

const getMultisetKey = (item) => {
  if (!item || typeof item !== 'object') return String(item || '')
  const content = item.raw_content || `${item.item_type || ''}|${item.name || item.item_name || ''}`
  return `${item.time || ''}||${content}`
}

const assignDeterministicSyntheticIds = (list, poolKey = 'bh3_char_a') => {
  const seqByTime = new Map()
  return list.map(item => {
    const timeKey = String(item.time || '')
    const seq = (seqByTime.get(timeKey) || 0) + 1
    seqByTime.set(timeKey, seq)
    return {
      ...item,
      id: buildBh3SyntheticId(timeKey, poolKey, seq)
    }
  })
}

/**
 * Multiset-safe merge for APIs without server-side record IDs (e.g. Honkai Impact 3rd).
 * Preserves legitimate identical items within the same second (e.g. 10-pull materials)
 * while deduplicating overlapping refreshes by matching multiplicity per (time, raw_content).
 */
const mergeMultisetList = (localList, incomingList, poolKey = 'bh3_char_a') => {
  const base = Array.isArray(localList) ? localList.map(item => ({ ...item })) : []
  const incoming = Array.isArray(incomingList) ? incomingList.map(item => ({ ...item })) : []
  if (!base.length && !incoming.length) return []

  const localCounts = new Map()
  const localBySig = new Map()
  for (const item of base) {
    const sig = getMultisetKey(item)
    localCounts.set(sig, (localCounts.get(sig) || 0) + 1)
    if (!localBySig.has(sig)) localBySig.set(sig, [])
    localBySig.get(sig).push(item)
  }

  const seenIncoming = new Map()
  const merged = [...base]

  for (const item of incoming) {
    const sig = getMultisetKey(item)
    const idx = (seenIncoming.get(sig) || 0) + 1
    seenIncoming.set(sig, idx)
    const existingCount = localCounts.get(sig) || 0
    if (idx <= existingCount) {
      // Refresh rank/type metadata on overlapping item if incoming resolved a stronger rank (e.g. Wiki cache update)
      const existingItem = localBySig.get(sig)?.[idx - 1]
      if (existingItem && item.rank_type && (!existingItem.rank_type || (existingItem.rank_type === '4' && item.rank_type === '5'))) {
        existingItem.rank_type = item.rank_type
      }
      continue
    }
    merged.push(item)
  }

  const withIndex = merged.map((item, idx) => ({
    item,
    idx,
    ts: Date.parse(String(item.time || '').replace(' ', 'T') + 'Z') || 0
  }))
  withIndex.sort((x, y) => (x.ts !== y.ts ? x.ts - y.ts : x.idx - y.idx))

  return assignDeterministicSyntheticIds(withIndex.map(x => x.item), poolKey)
}

const mergeData = (local, origin, options = {}) => {
  const useMultiset = Boolean(options && options.multiset)
  if (local && local.result) {
    const localResult = local.result
    const localUid = String(local.uid)
    const originUid = String(origin.uid)
    if (localUid !== originUid) {
      if (!useMultiset) return origin.result
      const normalized = new Map()
      for (const [key, value] of origin.result) {
        normalized.set(key, mergeMultisetList([], value, key))
      }
      return normalized
    }
    const mergedResult = new Map()
    for (const [key, value] of localResult) {
      mergedResult.set(key, value)
    }
    for (const [key, value] of origin.result) {
      const newVal = useMultiset
        ? mergeMultisetList(localResult.get(key), value, key)
        : mergeList(localResult.get(key), value)
      mergedResult.set(key, newVal)
    }
    return mergedResult
  }
  if (useMultiset && origin && origin.result) {
    const normalized = new Map()
    for (const [key, value] of origin.result) {
      normalized.set(key, mergeMultisetList([], value, key))
    }
    return normalized
  }
  return origin.result
}

module.exports = { mergeData, mergeList, mergeMultisetList, getRecordId }
