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

const mergeData = (local, origin) => {
  if (local && local.result) {
    const localResult = local.result
    const localUid = String(local.uid)
    const originUid = String(origin.uid)
    if (localUid !== originUid) return origin.result
    const mergedResult = new Map()
    for (const [key, value] of localResult) {
      mergedResult.set(key, value)
    }
    for (const [key, value] of origin.result) {
      const newVal = mergeList(localResult.get(key), value)
      mergedResult.set(key, newVal)
    }
    return mergedResult
  }
  return origin.result
}

module.exports = { mergeData, mergeList, getRecordId }
