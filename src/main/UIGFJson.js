const electron = process.versions.electron ? require('electron') : {}
const { app, ipcMain, dialog } = (typeof electron === 'object' && electron) ? electron : {}
const fs = require('fs-extra')
const path = require('path')
const Ajv = require('ajv')
const Ajv2020 = require('ajv/dist/2020')

const { getData, getDataPayload, getAllDataMaps, saveData, changeCurrent, getGachaType, normalizeLoadedData } = require('./getData')
const { version } = require('../../package.json')
const config = require('./config')
const i18n = require('./i18n')
const { mergeData } = require('./utils/mergeData')
const {
  readJSON,
  saveJSON,
  existsFile,
  getGameDataPath,
  fixLocalMap,
  md5,
  mapToObject,
  convertTimeZone,
  sendMsg,
  httpFetch
} = require('./utils')
const {
  GAME_IDS,
  UIGF_GAME_IDS,
  GAME_TO_UIGF_KEY,
  PORTABLE_KEY_TO_GAME,
  GAME_TO_PORTABLE_KEY,
  ID_JSON,
  detectDataGame,
  getGameAdapter
} = require('../games/registry')
const { getItemTypeNameMap } = require('../games/genshin/gachaTypeMap')
const { normalizeBeyondLang, normalizeBeyondPoolKey, getBeyondGachaTypeMap } = require('../games/beyond/gachaTypeMap')

const validateUigf30Json = new Ajv({ strict: false }).compile(require('../games/genshin/schema/uigf3_0.json'))
const validateUigf41Json = new Ajv2020({ strict: false }).compile(require('../games/genshin/schema/uigf4_1.json'))
const validateUigf42Json = new Ajv2020({ strict: false }).compile(require('../games/genshin/schema/uigf4_2.json'))
const validateLocalJson = new Ajv({ strict: false }).compile(require('../games/genshin/schema/local-data.json'))

const uigfLangMap = new Map([
  ['zh-cn', 'chs'],
  ['zh-tw', 'cht'],
  ['de-de', 'de'],
  ['en-us', 'en'],
  ['es-es', 'es'],
  ['fr-fr', 'fr'],
  ['id-id', 'id'],
  ['ja-jp', 'jp'],
  ['ko-kr', 'kr'],
  ['pt-pt', 'pt'],
  ['ru-ru', 'ru'],
  ['th-th', 'th'],
  ['vi-vn', 'vi']
])
const uigfRevLangMap = new Map(Array.from(uigfLangMap, ([key, value]) => [value, key]))

const getTimeString = () => {
  return new Date().toLocaleString('sv').replace(/[- :]/g, '').slice(0, -2)
}

const formatDate = (date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const h = `${date.getHours()}`.padStart(2, '0')
  const min = `${date.getMinutes()}`.padStart(2, '0')
  const s = `${date.getSeconds()}`.padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

const fakeIdFn = () => {
  let id = 1000000000000000000n
  return () => {
    id = id + 1n
    return id.toString()
  }
}

const shouldBeString = (value) => {
  if (typeof value !== 'string') return ''
  return value
}

// Genshin item_id dictionary (local cache + api.uigf.org)
const itemIdDict = new Map()
const itemIdDictMd5 = new Map()
const itemIdDictFileName = 'item-id-dict.json'

const fetchItemIdDict = async () => {
  let response = await httpFetch('https://api.uigf.org/dict/genshin/all.json', { timeout: 15 * 1000 })
  let responseJson = await response.json()
  if (response.status === 200) {
    Object.entries(responseJson).forEach(([lang, dict]) => {
      itemIdDict.set(lang, new Map(Object.entries(dict).map(([itemName, id]) => [itemName, String(id)])))
    })
  } else {
    console.error(`All dict fetch failed: HTTP ${response.status}: ` + (responseJson.detail || 'unknown error'))
    for (const [, lang] of uigfLangMap) {
      response = await httpFetch(`https://api.uigf.org/dict/genshin/${lang}.json`, { timeout: 15 * 1000 })
      const responseText = await response.text().catch(e => console.error(e))
      responseJson = JSON.parse(responseText)
      if (response.status !== 200) continue
      itemIdDict.set(lang, new Map(Object.entries(responseJson).map(([itemName, id]) => [itemName, String(id)])))
      itemIdDictMd5.set(lang, md5(responseText))
    }
  }
}

const fetchItemIdDictMd5 = async () => {
  const response = await httpFetch('https://api.uigf.org/md5/genshin', { timeout: 15 * 1000 })
  const responseJson = await response.json()
  if (response.status !== 200) throw new Error(`MD5 fetch failed: HTTP ${response.status}: ` + (responseJson.detail || 'unknown error'))
  Object.entries(responseJson).forEach(([lang, hash]) => itemIdDictMd5.set(lang, hash))
}

const initLookupTable = async () => {
  if (itemIdDict.size > 0) return

  await fetchItemIdDictMd5().catch(e => console.error(e))

  if (!existsFile(itemIdDictFileName)) {
    await fetchItemIdDict()
    return
  }

  const localItemIdDict = await readJSON(itemIdDictFileName)
  if (!localItemIdDict || typeof localItemIdDict.md5 === 'string') {
    await fetchItemIdDict()
    return
  }

  for (const [lang, hash] of itemIdDictMd5.entries()) {
    const localHash = localItemIdDict.md5?.[lang] || ''
    if (localHash !== hash) {
      await fetchItemIdDict()
      return
    }
  }

  if (localItemIdDict.lang) {
    for (const [lang, dict] of Object.entries(localItemIdDict.lang)) {
      itemIdDict.set(lang, new Map(Object.entries(dict).map(([itemName, id]) => [itemName, String(id)])))
    }
  }
}

const saveLookupTable = async () => {
  await saveJSON(itemIdDictFileName, {
    lang: mapToObject(itemIdDict),
    md5: mapToObject(itemIdDictMd5)
  })
}

const getGenshinItemId = async (lang, itemName) => {
  const normalizedLang = lang || 'chs'
  if (!itemIdDict.has(normalizedLang) || !itemIdDict.get(normalizedLang).has(itemName)) {
    const response = await httpFetch(`https://api.uigf.org/identify/genshin/${encodeURIComponent(itemName)}`, { timeout: 15 * 1000 })
    const responseJson = await response.json()
    if (response.status !== 200 || !responseJson?.matched?.length) {
      throw new Error(`Couldn't find the item_id for the ${itemName}.`)
    }
    if (!itemIdDict.has(normalizedLang)) {
      itemIdDict.set(normalizedLang, new Map())
    }
    itemIdDict.get(normalizedLang).set(itemName, String(responseJson.matched[0].item_id))
  }
  return itemIdDict.get(normalizedLang).get(itemName)
}

const inferTimezoneFromUid = (uid) => {
  const uidStr = String(uid || '')
  const uidMatch = uidStr.match(/^(?<prefix>\d{1,2})\d{8}$/)
  const uidPrefix = uidMatch?.groups?.prefix || uidStr[0] || ''
  if (['6'].includes(uidPrefix) || uidStr.startsWith('6')) return -5
  if (['7'].includes(uidPrefix) || uidStr.startsWith('7')) return 1
  return 8
}

const generateUigf30Json = async (targetUid = null) => {
  const { dataMap, current } = getData('genshin')
  const uid = targetUid || current
  const data = dataMap.get(uid)
  if (!data?.result?.size) {
    throw new Error('数据为空')
  }
  const fakeId = fakeIdFn()
  const result = {
    info: {
      uid: data.uid,
      lang: data.lang,
      export_time: formatDate(new Date()),
      export_timestamp: Math.round(Date.now() / 1000),
      export_app: 'hoyo-gacha-export',
      export_app_version: `v${version}`,
      uigf_version: 'v3.0',
      region_time_zone: inferTimezoneFromUid(data.uid)
    },
    list: []
  }
  const listTemp = []
  const uigfLang = uigfLangMap.get(data.lang) || uigfLangMap.get(fixLocalMap.get(data.lang)) || 'chs'
  for (const [type, arr] of data.result) {
    for (const item of arr) {
      listTemp.push({
        gacha_type: shouldBeString(item[4]) || type,
        time: item[0],
        timestamp: new Date(item[0]).getTime(),
        name: item[1],
        item_type: item[2],
        item_id: await getGenshinItemId(uigfLang, item[1]),
        rank_type: `${item[3]}`,
        id: shouldBeString(item[5]) || '',
        uigf_gacha_type: type
      })
    }
  }
  listTemp.sort((a, b) => a.timestamp - b.timestamp)
  listTemp.forEach(item => {
    delete item.timestamp
    result.list.push({
      ...item,
      id: item.id || fakeId()
    })
  })
  return result
}

const buildGenshinAccountExport = async (uid, data) => {
  const uigfLang = uigfLangMap.get(data.lang) || uigfLangMap.get(fixLocalMap.get(data.lang)) || 'chs'
  const fakeId = fakeIdFn()
  const account = {
    uid: String(uid),
    timezone: inferTimezoneFromUid(uid),
    lang: uigfRevLangMap.get(data.lang) || fixLocalMap.get(data.lang) || data.lang || 'zh-cn',
    list: []
  }
  for (const [gachaType, gachaList] of data.result) {
    for (const gacha of gachaList) {
      account.list.push({
        uigf_gacha_type: gachaType,
        gacha_type: shouldBeString(gacha[4]) || gachaType,
        item_id: await getGenshinItemId(uigfLang, gacha[1]),
        time: gacha[0],
        timestamp: new Date(gacha[0]).getTime(),
        name: gacha[1],
        item_type: gacha[2],
        rank_type: `${gacha[3]}`,
        id: shouldBeString(gacha[5]) || ''
      })
    }
  }
  account.list.sort((a, b) => a.timestamp - b.timestamp)
  account.list.forEach(item => {
    delete item.timestamp
    item.id = item.id || fakeId()
  })
  return account
}

const buildObjectGameAccountExport = (uid, data) => {
  const listTemp = []
  for (const [type, arr] of data.result) {
    arr.forEach(log => {
      listTemp.push({
        gacha_id: log.gacha_id || '',
        gacha_type: log.gacha_type || type,
        item_id: String(log.item_id || ''),
        count: String(log.count ?? '1'),
        time: log.time,
        name: log.name,
        item_type: log.item_type,
        rank_type: String(log.rank_type),
        id: String(log.id || '')
      })
    })
  }
  listTemp.sort((a, b) => {
    if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
      const diff = BigInt(a.id) - BigInt(b.id)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    }
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })
  return {
    uid: String(data.uid || uid),
    timezone: typeof data.region_time_zone === 'number' ? data.region_time_zone : 8,
    lang: uigfRevLangMap.get(data.lang) || fixLocalMap.get(data.lang) || data.lang || 'zh-cn',
    list: listTemp
  }
}

const resolveValidUigfLang = (rawLang) => {
  return normalizeBeyondLang(uigfRevLangMap.get(rawLang) || fixLocalMap.get(rawLang) || rawLang)
}

const buildBeyondAccountExport = (uid, data) => {
  const serverTimeZone = getGameAdapter('beyond').serverTimeZone
  const listTemp = []
  for (const [type, arr] of data.result) {
    arr.forEach(log => {
      const entry = {
        id: String(log.id || ''),
        schedule_id: String(log.schedule_id || log.gacha_id || ''),
        item_type: String(log.item_type || ''),
        item_id: String(log.item_id || ''),
        item_name: String(log.item_name ?? log.name ?? ''),
        rank_type: String(log.rank_type || ''),
        time: log.time,
        op_gacha_type: String(log.op_gacha_type || log.gacha_type || type)
      }
      if (log.region) {
        entry.region = String(log.region)
      }
      if (typeof log.is_up !== 'undefined' && log.is_up !== null && log.is_up !== '') {
        entry.is_up = String(log.is_up)
      }
      listTemp.push(entry)
    })
  }
  listTemp.sort((a, b) => {
    if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
      const diff = BigInt(a.id) - BigInt(b.id)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    }
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })
  let timezone
  if (typeof data.region_time_zone === 'number') {
    timezone = data.region_time_zone
  } else if (data.region && serverTimeZone.has(data.region)) {
    timezone = serverTimeZone.get(data.region)
  } else {
    timezone = inferTimezoneFromUid(uid)
  }
  const account = {
    uid: String(data.uid || uid),
    timezone,
    list: listTemp
  }
  const validLang = resolveValidUigfLang(data.lang)
  if (validLang) {
    account.lang = validLang
  }
  return account
}

/**
 * selections: array of `{ game, uid }` objects or legacy array of uids (for active game).
 */
const generateUigf4xJson = async (selections = null, allMaps = getAllDataMaps(), targetVersion = 'v4.2') => {
  const result = {
    info: {
      export_timestamp: Math.ceil(Date.now() / 1000),
      export_app: 'hoyo-gacha-export',
      export_app_version: `v${version}`,
      version: targetVersion
    }
  }

  let normalizedSelections
  if (Array.isArray(selections) && selections.length > 0) {
    normalizedSelections = selections.map(item => {
      if (typeof item === 'object' && item.game && item.uid) {
        return { game: item.game, uid: String(item.uid) }
      }
      return { game: config.currentGame, uid: String(item) }
    })
  } else {
    normalizedSelections = []
    for (const gameId of UIGF_GAME_IDS) {
      const map = allMaps[gameId]
      if (!map) continue
      for (const [uid, data] of map.entries()) {
        if (!data.deleted && data.result?.size) {
          normalizedSelections.push({ game: gameId, uid })
        }
      }
    }
  }

  if (!normalizedSelections.length) {
    throw new Error('数据为空')
  }

  const hasGenshin = normalizedSelections.some(s => s.game === 'genshin')
  if (hasGenshin) {
    await initLookupTable()
  }

  for (const { game, uid } of normalizedSelections) {
    const uigfKey = GAME_TO_UIGF_KEY[game]
    if (!uigfKey) continue
    const data = allMaps[game]?.get(uid)
    if (!data || !data.result?.size) continue
    if (!result[uigfKey]) {
      result[uigfKey] = []
    }
    if (game === 'genshin') {
      result[uigfKey].push(await buildGenshinAccountExport(uid, data))
    } else if (game === 'beyond') {
      result[uigfKey].push(buildBeyondAccountExport(uid, data))
    } else {
      result[uigfKey].push(buildObjectGameAccountExport(uid, data))
    }
  }

  if (!result.hk4e && !result.hkrpg && !result.nap && !result.hk4e_ugc) {
    throw new Error('数据为空')
  }

  if (result.hk4e_ugc) {
    result.info.version = 'v4.2'
  }

  if (hasGenshin) {
    await saveLookupTable()
  }

  return result
}

const generateUigf41Json = async (selections = null, allMaps = getAllDataMaps()) => {
  return await generateUigf4xJson(selections, allMaps, 'v4.1')
}

const generateUigf42Json = async (selections = null, allMaps = getAllDataMaps()) => {
  return await generateUigf4xJson(selections, allMaps, 'v4.2')
}

const start = async (selections, uigfVersion = '4.2') => {
  let result
  let defaultName
  if (uigfVersion === '3.0') {
    await initLookupTable()
    result = await generateUigf30Json()
    await saveLookupTable()
    defaultName = `UIGF_v3.0_${result.info.uid}_${getTimeString()}.json`
  } else {
    result = uigfVersion === '4.1'
      ? await generateUigf41Json(selections)
      : await generateUigf42Json(selections)
    const accounts = [
      ...(result.hk4e || []),
      ...(result.hkrpg || []),
      ...(result.nap || []),
      ...(result.hk4e_ugc || [])
    ]
    const uidSuffix = accounts.length === 1 ? `_${accounts[0].uid}` : ''
    defaultName = `UIGF_${result.info.version}${uidSuffix}_${getTimeString()}.json`
  }

  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, JSON.stringify(result, null, config.readableJSON ? '\t' : null))
  }
}

const fixUigfJson = (importData) => {
  try {
    if (importData.list) {
      importData.list.forEach(item => {
        if (!item.item_id) item.item_id = ''
        if (typeof item.rank_type !== 'undefined') item.rank_type = String(item.rank_type)
      })
    }
    for (const key of ['hk4e', 'hkrpg', 'nap', 'hk4e_ugc']) {
      if (Array.isArray(importData[key])) {
        importData[key].forEach(account => {
          if (typeof account.lang !== 'undefined') {
            const normalizedLang = normalizeBeyondLang(account.lang)
            if (normalizedLang) {
              account.lang = normalizedLang
            } else {
              delete account.lang
            }
          }
          if (Array.isArray(account.list)) {
            account.list.forEach(item => {
              item.item_id = item.item_id != null ? String(item.item_id) : ''
              if (item.id != null) item.id = String(item.id)
              if (item.schedule_id != null) item.schedule_id = String(item.schedule_id)
              if (item.op_gacha_type != null) item.op_gacha_type = String(item.op_gacha_type)
              if (typeof item.rank_type !== 'undefined') item.rank_type = String(item.rank_type)
              if (typeof item.count !== 'undefined') item.count = String(item.count)
            })
          }
        })
      }
    }
  } catch (e) {
    console.error(`Failed to fix UIGF Json: ${e}`)
  }
}

const saveAndBackup = async (data, gameId) => {
  const uid = String(data.uid)
  const fileName = `gacha-list-${uid}.json`
  if (existsFile(fileName, gameId)) {
    const backupDir = path.join(getGameDataPath(gameId), 'backup', uid)
    await fs.ensureDir(backupDir)
    await fs.copyFile(
      path.join(getGameDataPath(gameId), fileName),
      path.join(backupDir, `gacha-list-${uid}-${getTimeString()}.json`)
    )
  }
  const map = getAllDataMaps()[gameId]
  const normalizedData = {
    ...data,
    uid,
    result: data.result instanceof Map ? data.result : new Map(data.result),
    typeMap: data.typeMap instanceof Map ? data.typeMap : new Map(data.typeMap)
  }
  map.set(uid, normalizedData)
  await saveData(normalizedData, null, gameId)
  await changeCurrent(uid, gameId)
}

const importGenshinUigf30 = async (importData) => {
  const dataMap = getAllDataMaps().genshin
  const uid = String(importData.info.uid)
  const isNew = !dataMap.has(uid)
  const existing = dataMap.get(uid)
  const lang = importData.info.lang || existing?.lang || config.lang
  const gachaData = {
    result: new Map(),
    time: Date.now(),
    typeMap: getItemTypeNameMap(lang),
    uid,
    lang,
    deleted: isNew ? false : Boolean(existing.deleted)
  }
  gachaData.typeMap.forEach((_, k) => gachaData.result.set(k, []))
  const sorted = [...importData.list].sort((a, b) => {
    const diff = BigInt(a.id) - BigInt(b.id)
    return diff > 0n ? 1 : diff < 0n ? -1 : 0
  })
  for (const item of sorted) {
    const poolType = item.uigf_gacha_type || item.gacha_type
    if (!gachaData.result.has(poolType)) {
      gachaData.result.set(poolType, [])
    }
    gachaData.result.get(poolType).push([
      item.time,
      item.name || '',
      item.item_type || '',
      parseInt(item.rank_type, 10) || 3,
      item.gacha_type || poolType,
      item.id || ''
    ])
  }
  gachaData.result = mergeData(existing, gachaData)
  await saveAndBackup(gachaData, 'genshin')
}

const importGenshinUigf4x = async (accounts) => {
  const dataMap = getAllDataMaps().genshin
  for (const accountData of accounts) {
    const uid = String(accountData.uid)
    const isNew = !dataMap.has(uid)
    const existing = dataMap.get(uid)
    const lang = accountData.lang || existing?.lang || config.lang
    const gachaData = {
      result: new Map(),
      time: Date.now(),
      typeMap: getItemTypeNameMap(lang),
      uid,
      lang,
      deleted: isNew ? false : Boolean(existing.deleted)
    }
    gachaData.typeMap.forEach((_, k) => gachaData.result.set(k, []))
    const sorted = [...accountData.list].sort((a, b) => {
      const diff = BigInt(a.id) - BigInt(b.id)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    })
    for (const item of sorted) {
      const poolType = item.uigf_gacha_type || item.gacha_type
      if (!gachaData.result.has(poolType)) {
        gachaData.result.set(poolType, [])
      }
      gachaData.result.get(poolType).push([
        item.time,
        item.name || '',
        item.item_type || '',
        parseInt(item.rank_type, 10) || 3,
        item.gacha_type || poolType,
        item.id || ''
      ])
    }
    gachaData.result = mergeData(existing, gachaData)
    await saveAndBackup(gachaData, 'genshin')
  }
}

const importObjectGameAccount = async (uidData, gameId) => {
  const dataMap = getAllDataMaps()[gameId]
  const idJson = ID_JSON[gameId]
  const uid = String(uidData.uid)
  const isNew = !dataMap.has(uid)
  const existing = dataMap.get(uid)

  const regionTimeZone = isNew
    ? (typeof uidData.timezone === 'number' ? uidData.timezone : 8)
    : existing.region_time_zone

  let targetLang = isNew ? (uidData.lang || config.lang) : existing.lang
  const firstItem = uidData.list?.[0] || {}
  if (!idJson[targetLang] && (!firstItem.name || !firstItem.item_type || !firstItem.rank_type)) {
    targetLang = config.lang
  }
  const idTargetLangJson = idJson[targetLang] || {}

  const grouped = {}
  for (const recordEntry of uidData.list || []) {
    const dictEntry = idTargetLangJson?.[recordEntry.item_id]
    const timeVal = gameId === 'zzz'
      ? convertTimeZone(recordEntry.time, uidData.timezone, regionTimeZone)
      : recordEntry.time
    const rankType = dictEntry?.rank_type
      ? String(dictEntry.rank_type)
      : String(recordEntry.rank_type || '')
    const poolKey = String(recordEntry.gacha_type)
    if (!grouped[poolKey]) {
      grouped[poolKey] = []
    }
    grouped[poolKey].push({
      gacha_id: recordEntry.gacha_id || '',
      gacha_type: poolKey,
      item_id: String(recordEntry.item_id || ''),
      count: String(recordEntry.count ?? '1'),
      time: timeVal,
      name: dictEntry?.name ?? recordEntry.name ?? '',
      item_type: dictEntry?.item_type ?? recordEntry.item_type ?? '',
      rank_type: rankType,
      id: String(recordEntry.id || '')
    })
  }

  const incomingMap = { result: new Map(Object.entries(grouped)), uid }
  const mergedResult = mergeData(existing, incomingMap)
  const typeMap = getGachaType(targetLang, gameId)
  const finalData = {
    result: mergedResult,
    typeMap,
    time: Date.now(),
    uid,
    lang: targetLang,
    region_time_zone: regionTimeZone,
    deleted: isNew ? false : Boolean(existing.deleted)
  }

  await saveAndBackup(finalData, gameId)
}

const importBeyondUigf4x = async (accounts) => {
  const dataMap = getAllDataMaps().beyond

  for (const accountData of accounts) {
    const uid = String(accountData.uid)
    const isNew = !dataMap.has(uid)
    const existing = dataMap.get(uid)

    const incomingTimezone = typeof accountData.timezone === 'number' ? accountData.timezone : undefined
    const regionTimeZone = isNew
      ? (incomingTimezone ?? inferTimezoneFromUid(uid))
      : (typeof existing.region_time_zone === 'number' ? existing.region_time_zone : (incomingTimezone ?? inferTimezoneFromUid(uid)))

    const rawLang = isNew ? (accountData.lang || config.lang) : (existing.lang || accountData.lang || config.lang)
    const targetLang = normalizeBeyondLang(rawLang) || config.lang || 'zh-cn'

    const grouped = {}
    let detectedRegion = existing?.region || ''
    for (const recordEntry of accountData.list || []) {
      const opType = String(recordEntry.op_gacha_type || recordEntry.gacha_type || '2000')
      const poolKey = normalizeBeyondPoolKey(opType)
      const timeVal = typeof incomingTimezone === 'number' && typeof regionTimeZone === 'number'
        ? convertTimeZone(recordEntry.time, incomingTimezone, regionTimeZone)
        : recordEntry.time
      const itemName = recordEntry.item_name ?? recordEntry.name ?? ''
      const itemRegion = recordEntry.region ? String(recordEntry.region) : ''
      if (!detectedRegion && itemRegion) {
        detectedRegion = itemRegion
      }
      if (!grouped[poolKey]) {
        grouped[poolKey] = []
      }
      grouped[poolKey].push({
        id: String(recordEntry.id || ''),
        schedule_id: String(recordEntry.schedule_id || recordEntry.gacha_id || ''),
        op_gacha_type: opType,
        gacha_type: poolKey,
        item_id: String(recordEntry.item_id || ''),
        item_type: recordEntry.item_type || '',
        name: itemName,
        item_name: itemName,
        rank_type: String(recordEntry.rank_type || ''),
        time: timeVal,
        region: itemRegion,
        is_up: (typeof recordEntry.is_up !== 'undefined' && recordEntry.is_up !== null && recordEntry.is_up !== '')
          ? String(recordEntry.is_up)
          : '',
        count: String(recordEntry.count ?? '1')
      })
    }

    const incomingMap = { result: new Map(Object.entries(grouped)), uid }
    const mergedResult = mergeData(existing, incomingMap)
    const typeMap = getBeyondGachaTypeMap(targetLang)
    const finalData = {
      result: mergedResult,
      typeMap,
      time: Date.now(),
      uid,
      lang: targetLang,
      region_time_zone: regionTimeZone,
      deleted: isNew ? false : Boolean(existing.deleted)
    }
    if (detectedRegion) {
      finalData.region = detectedRegion
    }

    await saveAndBackup(finalData, 'beyond')
  }
}

const generatePortableGameJson = (gameId = config.currentGame, targetUid = null, allMaps = getAllDataMaps()) => {
  const map = allMaps[gameId]
  const uid = String(targetUid || config.getGameConfig(gameId).current || '')
  const data = map?.get(uid)
  if (!data || !data.result?.size) {
    throw new Error('数据为空')
  }
  const adapter = getGameAdapter(gameId)
  const typeMap = data.typeMap instanceof Map
    ? data.typeMap
    : new Map(Array.isArray(data.typeMap) ? data.typeMap : adapter.defaultTypeMap)
  const listTemp = []

  for (const [poolKey, arr] of data.result) {
    if (!Array.isArray(arr)) continue
    const poolName = typeMap.get(poolKey) || ''
    for (const log of arr) {
      if (Array.isArray(log)) {
        listTemp.push({
          id: shouldBeString(log[5]) || '',
          gacha_type: shouldBeString(log[4]) || String(poolKey),
          pool_name: poolName,
          time: log[0],
          name: log[1],
          item_type: log[2],
          rank_type: String(log[3]),
          count: '1'
        })
      } else if (log && typeof log === 'object') {
        const entry = {
          id: String(log.id || ''),
          gacha_type: String(log.gacha_type || poolKey),
          pool_name: log.pool_name || poolName,
          time: log.time,
          name: log.item_name ?? log.name ?? '',
          item_type: log.item_type || '',
          rank_type: String(log.rank_type || ''),
          count: String(log.count ?? '1')
        }
        if (log.item_id) entry.item_id = String(log.item_id)
        if (log.gacha_id) entry.gacha_id = String(log.gacha_id)
        if (log.raw_content) entry.raw_content = String(log.raw_content)
        if (log.raw_type) entry.raw_type = String(log.raw_type)
        if (log.pool_id) entry.pool_id = String(log.pool_id)
        if (log.blind_box_sub_rarity) entry.blind_box_sub_rarity = String(log.blind_box_sub_rarity)
        if (log.pet_id) entry.pet_id = String(log.pet_id)
        if (log.chroma_appearance_id) entry.chroma_appearance_id = String(log.chroma_appearance_id)
        if (log.pet_type) entry.pet_type = String(log.pet_type)
        listTemp.push(entry)
      }
    }
  }

  listTemp.sort((a, b) => {
    const tsA = Date.parse(String(a.time || '').replace(' ', 'T') + 'Z') || 0
    const tsB = Date.parse(String(b.time || '').replace(' ', 'T') + 'Z') || 0
    if (tsA !== tsB) return tsA - tsB
    if (/^\d+$/.test(a.id) && /^\d+$/.test(b.id)) {
      const diff = BigInt(a.id) - BigInt(b.id)
      return diff > 0n ? 1 : diff < 0n ? -1 : 0
    }
    return 0
  })

  return {
    info: {
      format: 'hoyo-gacha-portable-v1',
      game: gameId,
      portable_key: GAME_TO_PORTABLE_KEY[gameId] || GAME_TO_UIGF_KEY[gameId] || gameId,
      game_biz: adapter.gameBiz || gameId,
      uid: String(data.uid || uid),
      lang: data.lang || config.lang || 'zh-cn',
      region_time_zone: typeof data.region_time_zone === 'number' ? data.region_time_zone : 8,
      export_time: formatDate(new Date()),
      export_timestamp: Math.round(Date.now() / 1000),
      export_app: 'hoyo-gacha-export',
      export_app_version: `v${version}`
    },
    typeMap: [...typeMap.entries()],
    list: listTemp
  }
}

const exportPortableGameJson = async (gameId = config.currentGame, targetUid = null) => {
  const result = generatePortableGameJson(gameId, targetUid)
  const defaultName = `${gameId}_${result.info.uid}_${getTimeString()}.json`
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [
      { name: 'JSON', extensions: ['json'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, JSON.stringify(result, null, config.readableJSON ? '\t' : null))
  }
}

const resolvePortableGameId = (rawKey) => {
  const key = String(rawKey || '').trim().toLowerCase()
  if (!key) return null
  if (GAME_IDS.includes(key)) return key
  if (PORTABLE_KEY_TO_GAME[key]) return PORTABLE_KEY_TO_GAME[key]
  if (key === 'hk4e' || key === 'hk4e_cn' || key === 'hk4e_global') return 'genshin'
  if (key === 'hkrpg' || key === 'hkrpg_cn' || key === 'hkrpg_global') return 'starrail'
  if (key === 'nap' || key === 'nap_cn' || key === 'nap_global') return 'zzz'
  if (key === 'hk4e_ugc') return 'beyond'
  return null
}

const importPortableAccount = async (accountData, gameId) => {
  const adapter = getGameAdapter(gameId)
  const dataMap = getAllDataMaps()[gameId]
  const uid = String(accountData.uid || `${gameId}_imported`)
  const isNew = !dataMap.has(uid)
  const existing = dataMap.get(uid)
  const targetLang = isNew ? (accountData.lang || config.lang) : (existing.lang || accountData.lang || config.lang)
  const regionTimeZone = typeof accountData.timezone === 'number'
    ? accountData.timezone
    : (typeof accountData.region_time_zone === 'number' ? accountData.region_time_zone : (existing?.region_time_zone ?? 8))

  const incomingTypeMap = new Map(getGachaType(targetLang, gameId))
  if (Array.isArray(accountData.typeMap)) {
    for (const pair of accountData.typeMap) {
      if (Array.isArray(pair) && pair.length >= 2) {
        incomingTypeMap.set(String(pair[0]), String(pair[1]))
      }
    }
  } else if (accountData.typeMap instanceof Map) {
    for (const [k, v] of accountData.typeMap.entries()) {
      incomingTypeMap.set(String(k), String(v))
    }
  }

  const grouped = new Map()
  const rawList = Array.isArray(accountData.list) ? accountData.list : []

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue
    if (gameId === 'bh3') {
      const parsed = adapter.parseBh3ApiRecord(entry)
      if (!parsed || !parsed.name) continue
      const poolLabel = String(entry.pool_name || entry.pool || '')
      const poolKey = entry.gacha_type && String(entry.gacha_type).startsWith('bh3_')
        ? String(entry.gacha_type)
        : adapter.normalizeBh3PoolKey(poolLabel || entry.gacha_type || '', entry.raw_type || '')
      if (!grouped.has(poolKey)) grouped.set(poolKey, [])
      if (!incomingTypeMap.has(poolKey)) {
        incomingTypeMap.set(poolKey, poolLabel || poolKey)
      }
      const rankType = parsed.rank_type || (entry.rank_type != null ? String(entry.rank_type) : adapter.resolveBh3Rank(parsed.item_type, parsed.name))
      grouped.get(poolKey).push({
        id: entry.id ? String(entry.id) : '',
        gacha_type: poolKey,
        pool_name: incomingTypeMap.get(poolKey) || poolLabel || poolKey,
        raw_type: entry.raw_type ? String(entry.raw_type) : '',
        time: parsed.time,
        name: parsed.name,
        item_type: parsed.item_type,
        rank_type: String(rankType),
        raw_content: parsed.raw_content,
        count: String(entry.count ?? '1')
      })
    } else if (gameId === 'starrail_blindbox') {
      const poolId = String(entry.pool_id || entry.gacha_type || '1001')
      if (!grouped.has(poolId)) grouped.set(poolId, [])
      if (!incomingTypeMap.has(poolId)) {
        incomingTypeMap.set(poolId, entry.pool_name || `星际潮玩 (${poolId})`)
      }
      const subRarity = entry.blind_box_sub_rarity != null ? String(entry.blind_box_sub_rarity) : ''
      const rankType = subRarity
        ? adapter.mapBlindBoxRarity(subRarity, entry.rank_type)
        : String(entry.rank_type || '3')
      const itemName = entry.item_name ?? entry.name ?? ''
      grouped.get(poolId).push({
        id: String(entry.id || ''),
        pool_id: poolId,
        gacha_id: poolId,
        gacha_type: poolId,
        item_id: String(entry.item_id || ''),
        item_type: entry.item_type || entry.type_name || '',
        name: itemName,
        item_name: itemName,
        rank_type: rankType,
        blind_box_sub_rarity: subRarity,
        pet_id: entry.pet_id != null ? String(entry.pet_id) : '',
        chroma_appearance_id: entry.chroma_appearance_id != null ? String(entry.chroma_appearance_id) : '',
        pet_type: entry.pet_type != null ? String(entry.pet_type) : '',
        time: entry.time || '',
        count: String(entry.count ?? '1')
      })
    } else {
      const poolKey = String(entry.gacha_type || adapter.order[0] || 'default')
      if (!grouped.has(poolKey)) grouped.set(poolKey, [])
      if (!incomingTypeMap.has(poolKey)) {
        incomingTypeMap.set(poolKey, entry.pool_name || poolKey)
      }
      grouped.get(poolKey).push({
        id: String(entry.id || ''),
        gacha_id: String(entry.gacha_id || ''),
        gacha_type: poolKey,
        item_id: String(entry.item_id || ''),
        item_type: entry.item_type || '',
        name: entry.name ?? entry.item_name ?? '',
        rank_type: String(entry.rank_type || '3'),
        time: entry.time || '',
        count: String(entry.count ?? '1')
      })
    }
  }

  const mergedTypeMap = new Map(existing?.typeMap instanceof Map ? existing.typeMap : [])
  for (const [k, v] of incomingTypeMap.entries()) {
    mergedTypeMap.set(k, v)
  }

  const incomingObj = { result: grouped, uid }
  const mergedResult = mergeData(existing, incomingObj, { multiset: gameId === 'bh3' })
  const finalData = {
    result: mergedResult,
    typeMap: mergedTypeMap,
    time: Date.now(),
    uid,
    lang: targetLang,
    region_time_zone: regionTimeZone,
    deleted: isNew ? false : Boolean(existing.deleted)
  }
  await saveAndBackup(finalData, gameId)
}

const importHoYoGetBh3Json = async (importData) => {
  if (Array.isArray(importData.bh3) && importData.bh3.length) {
    for (const acc of importData.bh3) {
      await importPortableAccount(acc, 'bh3')
    }
    return
  }

  const uid = String(importData.uid || importData.info?.uid || 'bh3_imported')
  const lang = importData.lang || importData.info?.lang || config.lang
  const poolsObj = importData.pools || importData.data || {}
  const list = []
  for (const [poolName, poolVal] of Object.entries(poolsObj)) {
    const records = Array.isArray(poolVal)
      ? poolVal
      : (Array.isArray(poolVal?.records) ? poolVal.records : (Array.isArray(poolVal?.list) ? poolVal.list : []))
    for (const rec of records) {
      if (!rec || typeof rec !== 'object') continue
      list.push({
        ...rec,
        pool_name: rec.pool_name || poolName
      })
    }
  }
  await importPortableAccount({ uid, lang, list }, 'bh3')
}

const importParsedJson = async (importData) => {
  const importedGames = []

  // Portable single-game or multi-game format (hoyo-gacha-portable-v1)
  if (importData?.info?.format === 'hoyo-gacha-portable-v1') {
    if (Array.isArray(importData.list)) {
      const gameId = resolvePortableGameId(importData.info.game || importData.info.portable_key || importData.info.game_biz)
      if (!gameId) {
        throw new Error('Unable to identify game for portable JSON file')
      }
      await importPortableAccount({
        uid: importData.info.uid,
        lang: importData.info.lang,
        timezone: importData.info.region_time_zone,
        typeMap: importData.typeMap,
        list: importData.list
      }, gameId)
      importedGames.push(gameId)
      return importedGames
    }
    for (const [key, accounts] of Object.entries(importData)) {
      if (key === 'info' || !Array.isArray(accounts) || !accounts.length) continue
      const gameId = resolvePortableGameId(key)
      if (!gameId) continue
      for (const acc of accounts) {
        await importPortableAccount(acc, gameId)
      }
      importedGames.push(gameId)
    }
    if (importedGames.length) return importedGames
  }

  // HoYoGet-Plugin BH3 export format
  if (
    (importData?.game === 'bh3' && (importData.pools || importData.data || Array.isArray(importData.list))) ||
    (!importData?.info?.version && Array.isArray(importData?.bh3) && importData.bh3.length)
  ) {
    if (Array.isArray(importData.list)) {
      await importPortableAccount({
        uid: importData.uid || 'bh3_imported',
        lang: importData.lang || config.lang,
        list: importData.list
      }, 'bh3')
    } else {
      await importHoYoGetBh3Json(importData)
    }
    importedGames.push('bh3')
    return importedGames
  }

  // Legacy single-game local-data format
  if (validateLocalJson(importData) || (!importData?.info && importData?.result && importData?.uid)) {
    const detectedGame = detectDataGame(importData)
    if (!detectedGame) {
      throw new Error('Unable to identify game for local JSON file')
    }
    const normalized = normalizeLoadedData(importData, detectedGame)
    const existing = getAllDataMaps()[detectedGame]?.get(normalized.uid)
    normalized.result = mergeData(existing, normalized, { multiset: detectedGame === 'bh3' })
    await saveAndBackup(normalized, detectedGame)
    importedGames.push(detectedGame)
    return importedGames
  }

  fixUigfJson(importData)

  if (importData?.info?.version && ['v4.0', 'v4.1', 'v4.2'].includes(importData.info.version)) {
    const validator = (importData.info.version === 'v4.2' || Array.isArray(importData.hk4e_ugc))
      ? validateUigf42Json
      : validateUigf41Json
    if (!validator(importData)) {
      throw new Error('UIGF v4.x format validation failed')
    }
    if (Array.isArray(importData.hk4e) && importData.hk4e.length) {
      await importGenshinUigf4x(importData.hk4e)
      importedGames.push('genshin')
    }
    if (Array.isArray(importData.hkrpg) && importData.hkrpg.length) {
      for (const account of importData.hkrpg) {
        await importObjectGameAccount(account, 'starrail')
      }
      importedGames.push('starrail')
    }
    if (Array.isArray(importData.nap) && importData.nap.length) {
      for (const account of importData.nap) {
        await importObjectGameAccount(account, 'zzz')
      }
      importedGames.push('zzz')
    }
    if (Array.isArray(importData.hk4e_ugc) && importData.hk4e_ugc.length) {
      await importBeyondUigf4x(importData.hk4e_ugc)
      importedGames.push('beyond')
    }
    if (!importedGames.length) {
      throw new Error('UIGF file contains no supported game records')
    }
    return importedGames
  }

  if (validateUigf30Json(importData)) {
    await importGenshinUigf30(importData)
    importedGames.push('genshin')
    return importedGames
  }

  if (importData?.info?.srgf_version && Array.isArray(importData.list)) {
    await importObjectGameAccount({
      uid: importData.info.uid,
      lang: importData.info.lang,
      timezone: importData.info.region_time_zone,
      list: importData.list
    }, 'starrail')
    importedGames.push('starrail')
    return importedGames
  }

  throw new Error('JSON format error')
}

const importJson = async () => {
  const filePathArr = dialog.showOpenDialogSync({
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [
      { name: i18n.uigf.fileType || 'JSON', extensions: ['json'] }
    ]
  })
  if (!filePathArr) return 'canceled'

  try {
    const filePath = filePathArr[0]
    const importData = await fs.readJSON(filePath)
    const importedGames = await importParsedJson(importData)
    if (importedGames.length === 1) {
      config.currentGame = importedGames[0]
      await config.save()
    }
    return {
      importedGames,
      ...getDataPayload(config.currentGame)
    }
  } catch (error) {
    sendMsg(error, 'ERROR')
    throw error
  }
}

if (ipcMain) {
  ipcMain.handle('EXPORT_UIGF_JSON', async (event, selections, uigfVersion = '4.2') => {
    await start(selections, uigfVersion)
  })

  ipcMain.handle('EXPORT_GAME_JSON', async (event, gameId = null, targetUid = null) => {
    await exportPortableGameJson(gameId || config.currentGame, targetUid)
  })

  ipcMain.handle('IMPORT_UIGF_JSON', async () => {
    return await importJson()
  })
}

module.exports = {
  generateUigf30Json,
  generateUigf41Json,
  generateUigf42Json,
  generatePortableGameJson,
  exportPortableGameJson,
  importJson,
  importParsedJson,
  importPortableAccount,
  importHoYoGetBh3Json,
  importGenshinUigf30,
  importGenshinUigf4x,
  importObjectGameAccount,
  importBeyondUigf4x,
  fixUigfJson,
  inferTimezoneFromUid
}
