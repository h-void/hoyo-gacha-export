const fs = require('fs-extra')
const path = require('path')
const { URL } = require('url')
const electron = process.versions.electron ? require('electron') : {}
const { app, ipcMain, shell } = (typeof electron === 'object' && electron) ? electron : {}
const {
  readdir,
  sleep,
  request,
  sendMsg,
  readJSON,
  saveJSON,
  detectLocale,
  getCacheText,
  getGameDataPath,
  userDataPath,
  userPath,
  localIp,
  langMap,
  convertTimeZone
} = require('./utils')
const config = require('./config')
const i18n = require('./i18n')
const { enableProxy, disableProxy } = require('./module/system-proxy')
const mitmproxy = require('./module/node-mitmproxy')
const { mergeData, mergeList } = require('./utils/mergeData')
const { GAME_IDS, getGameAdapter, detectDataGame } = require('../games/registry')

const dataMapByGame = {
  genshin: new Map(),
  starrail: new Map(),
  zzz: new Map(),
  beyond: new Map()
}

const cacheFolderByGame = {
  genshin: null,
  starrail: null,
  zzz: null,
  beyond: null
}

const apiDomainByGame = {
  genshin: 'https://public-operation-hk4e.mihoyo.com',
  starrail: 'https://public-operation-hkrpg.mihoyo.com',
  zzz: 'https://public-operation-nap.mihoyo.com',
  beyond: 'https://public-operation-hk4e.mihoyo.com'
}

const getDataMap = (gameId = config.currentGame) => {
  return dataMapByGame[gameId] || dataMapByGame.genshin
}

const saveData = async (data, url, gameId = config.currentGame) => {
  const obj = Object.assign({}, data)
  obj.result = [...obj.result]
  obj.typeMap = obj.typeMap instanceof Map ? [...obj.typeMap] : obj.typeMap
  if (url) {
    config.getUrlsMap(gameId).set(data.uid, url)
  }
  await config.save()
  await saveJSON(`gacha-list-${data.uid}.json`, obj, gameId)
}

const normalizeLoadedData = (rawData, gameId) => {
  const adapter = getGameAdapter(gameId)
  const data = Object.assign({}, rawData)
  data.uid = String(data.uid || '')
  data.typeMap = (Array.isArray(data.typeMap) || data.typeMap instanceof Map)
    ? new Map(data.typeMap)
    : new Map(adapter.defaultTypeMap)
  data.result = new Map(data.result)
  if (gameId === 'beyond') {
    const normalizedResult = new Map()
    data.result.forEach((value, rawKey) => {
      if (!Array.isArray(value)) return
      const targetKey = adapter.normalizePoolKey ? adapter.normalizePoolKey(rawKey) : String(rawKey)
      const mapped = value.map(item => {
        if (!item || typeof item !== 'object') return item
        const opType = String(item.op_gacha_type || item.gacha_type || rawKey)
        const itemName = item.item_name || item.name || ''
        return {
          ...item,
          id: String(item.id || ''),
          schedule_id: String(item.schedule_id || item.gacha_id || ''),
          op_gacha_type: opType,
          gacha_type: adapter.normalizePoolKey ? adapter.normalizePoolKey(opType) : targetKey,
          item_id: String(item.item_id || ''),
          item_type: item.item_type || '',
          name: itemName,
          item_name: itemName,
          rank_type: String(item.rank_type || ''),
          count: item.count ?? '1'
        }
      })
      const existing = normalizedResult.get(targetKey)
      normalizedResult.set(targetKey, existing ? mergeList(existing, mapped) : mapped)
    })
    data.result = normalizedResult
  } else if (gameId !== 'genshin') {
    data.result.forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item && typeof item === 'object' && !('count' in item)) {
            item.count = '1'
          }
        })
      }
    })
  }
  return data
}

// Migrate legacy root userData/gacha-list-*.json files into userData/<game>/
const migrateLegacyFiles = async () => {
  await fs.ensureDir(userDataPath)
  const files = await readdir(userDataPath)
  for (const name of files) {
    if (!/^gacha-list-\d+\.json$/.test(name)) continue
    try {
      const rawData = await readJSON(userDataPath, name)
      const detectedGame = detectDataGame(rawData)
      if (!detectedGame) continue
      const targetDir = getGameDataPath(detectedGame)
      await fs.ensureDir(targetDir)
      const targetFile = path.join(targetDir, name)
      const sourceFile = path.join(userDataPath, name)
      if (!(await fs.pathExists(targetFile))) {
        await fs.move(sourceFile, targetFile)
      }
    } catch (e) {
      sendMsg(e, 'ERROR')
    }
  }
}

let localDataReaded = false
const readData = async (force = false) => {
  if (localDataReaded && !force) return
  if (config.ready) {
    await config.ready
  }
  localDataReaded = true
  await migrateLegacyFiles()

  for (const gameId of GAME_IDS) {
    const gameDir = getGameDataPath(gameId)
    await fs.ensureDir(gameDir)
    const map = dataMapByGame[gameId]
    if (force) map.clear()
    const files = await readdir(gameDir)
    for (const name of files) {
      if (!/^gacha-list-\d+\.json$/.test(name)) continue
      try {
        const rawData = await readJSON(gameDir, name)
        if (!rawData) continue
        const data = normalizeLoadedData(rawData, gameId)
        if (data.uid) {
          map.set(data.uid, data)
        }
      } catch (e) {
        sendMsg(e, 'ERROR')
      }
    }

    const gameCfg = config.getGameConfig(gameId)
    const activeEntries = Array.from(map.entries()).filter(([, d]) => !d.deleted)
    if (
      (!gameCfg.current && activeEntries.length) ||
      (gameCfg.current && map.size && !map.has(gameCfg.current))
    ) {
      const nextUid = activeEntries.length ? activeEntries[0][0] : map.keys().next().value
      config.setGameConfig(gameId, 'current', nextUid || 0)
      await config.save()
    }
  }
}

const deleteData = async (uid, action, gameId = config.currentGame) => {
  const map = getDataMap(gameId)
  const data = map.get(uid)
  if (data) {
    data.deleted = action
    await saveData(data, null, gameId)
  }
}

const changeCurrent = async (uid, gameId = config.currentGame) => {
  config.setGameConfig(gameId, 'current', uid)
  await config.save()
}

const switchGame = async (gameId) => {
  if (!GAME_IDS.includes(gameId)) return getDataPayload()
  config.currentGame = gameId
  await config.save()
  return getDataPayload()
}

const getLatestUrl = (list) => {
  return list[list.length - 1]
}

const resolveUserHomePath = () => {
  if (!process.env.WINEPREFIX) {
    return app ? app.getPath('home') : require('os').homedir()
  }
  return path.join(process.env.WINEPREFIX, 'drive_c/users', process.env.USER)
}

const readLog = async (gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const gameCfg = config.getGameConfig(gameId)
  try {
    const userPathResolved = resolveUserHomePath()
    const appLocale = app ? app.getLocale() : 'zh-CN'
    const candidateEntries = adapter.getLogEntries(userPathResolved, gameCfg.logType, appLocale)
    const existingEntries = []
    for (const entry of candidateEntries) {
      try {
        await fs.access(entry.path, fs.constants.F_OK)
        existingEntries.push(entry)
      } catch (e) {}
    }

    if (!existingEntries.length) {
      sendMsg(text.file.notFound)
      return false
    }

    const promises = existingEntries.map(async (entry) => {
      const logText = await fs.readFile(entry.path, 'utf8')
      if (entry.mode === 'direct') {
        const urlMch = logText.match(adapter.urlRegex)
        if (urlMch && urlMch.length) {
          return { primary: getLatestUrl(urlMch), fallback: null }
        }
        if (adapter.fallbackUrlRegex) {
          const fallbackMch = logText.match(adapter.fallbackUrlRegex)
          if (fallbackMch && fallbackMch.length) {
            return { primary: null, fallback: getLatestUrl(fallbackMch) }
          }
        }
        return null
      }

      if (entry.mode === 'zzz') {
        if (adapter.directLogUrlRegex) {
          const directMch = logText.match(adapter.directLogUrlRegex)
          if (directMch && directMch.length) {
            return { primary: getLatestUrl(directMch), fallback: null }
          }
        }
        const gamePathMch = logText.match(entry.regex)
        if (gamePathMch) {
          const [cacheText, cacheFile] = await getCacheText(path.join(gamePathMch[0], 'ZenlessZoneZero_Data'))
          const urlMch = cacheText.match(adapter.urlRegex)
          if (urlMch && urlMch.length) {
            cacheFolderByGame[gameId] = cacheFile.replace(/Cache_Data[/\\]data_2$/, '')
            return { primary: getLatestUrl(urlMch), fallback: null }
          }
        }
        return null
      }

      const gamePathMch = logText.match(entry.regex)
      if (gamePathMch) {
        const [cacheText, cacheFile] = await getCacheText(gamePathMch[0])
        const cacheFolder = cacheFile ? cacheFile.replace(/Cache_Data[/\\]data_2$/, '') : null
        const urlMch = cacheText.match(adapter.urlRegex)
        if (urlMch && urlMch.length) {
          cacheFolderByGame[gameId] = cacheFolder
          return { primary: getLatestUrl(urlMch), fallback: null }
        }
        if (adapter.fallbackUrlRegex) {
          const fallbackMch = cacheText.match(adapter.fallbackUrlRegex)
          if (fallbackMch && fallbackMch.length) {
            if (!cacheFolderByGame[gameId] && cacheFolder) {
              cacheFolderByGame[gameId] = cacheFolder
            }
            return { primary: null, fallback: getLatestUrl(fallbackMch) }
          }
        }
      }
      return null
    })

    const results = await Promise.all(promises)
    for (const res of results) {
      if (res && res.primary) {
        return res.primary
      }
    }
    for (const res of results) {
      if (res && res.fallback) {
        return res.fallback
      }
    }
    sendMsg(text.url.notFound)
    return false
  } catch (e) {
    sendMsg(text.file.readFailed)
    return false
  }
}

const fixAuthkey = (url) => {
  const mr = url.match(/authkey=([^&]+)/)
  if (mr && mr[1] && mr[1].includes('=') && !mr[1].includes('%')) {
    return url.replace(/authkey=([^&]+)/, `authkey=${encodeURIComponent(mr[1])}`)
  }
  return url
}

const getQuerystring = (url, gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const { searchParams, host } = new URL(fixAuthkey(url))
  apiDomainByGame[gameId] = adapter.getApiDomain(host)
  const authkey = searchParams.get('authkey')
  if (!authkey) {
    sendMsg(text.url.lackAuth)
    return false
  }
  adapter.cleanSearchParams(searchParams)
  return searchParams
}

const checkResStatus = (res, gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  if (res.retcode !== 0) {
    let message = res.message
    if (res.message === 'authkey timeout') {
      message = text.fetch.authTimeout
      sendMsg(true, 'AUTHKEY_TIMEOUT')
    }
    sendMsg(message)
    throw new Error(message)
  }
  sendMsg(false, 'AUTHKEY_TIMEOUT')
  return res
}

const getGachaLog = async ({ gameId, key, page, name, retryCount, url, endId }) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  try {
    const paramKey = adapter.queryParamKey
    const useBigIntEndId = gameId === 'genshin' || gameId === 'beyond'
    const pageSize = adapter.pageSize || 20
    const endIdSuffix = gameId === 'genshin'
      ? (endId ? `&end_id=${endId}` : '')
      : `&end_id=${endId || '0'}`
    const res = await request(`${url}&${paramKey}=${key}&page=${page}&size=${pageSize}${endIdSuffix}`)
    if (useBigIntEndId) {
      checkResStatus(res, gameId)
      return res.data
    }
    if (res?.data?.list) {
      return res.data
    }
    throw new Error(res?.message || JSON.stringify(res))
  } catch (e) {
    if (retryCount) {
      sendMsg(i18n.parse(text.fetch.retry, { name, page, count: 6 - retryCount }))
      await sleep(5)
      return await getGachaLog({ gameId, key, page, name, retryCount: retryCount - 1, url, endId })
    }
    sendMsg(i18n.parse(text.fetch.retryFailed, { name, page }))
    throw e
  }
}

const getGachaLogs = async (gameId, [key, name], queryString, knownUid = '') => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const map = getDataMap(gameId)
  let page = 1
  const list = []
  let res = null
  let logs = []
  let uid = ''
  let region = ''
  let region_time_zone
  const useBigIntEndId = gameId === 'genshin' || gameId === 'beyond'
  let endId = useBigIntEndId ? 0 : '0'
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const url = adapter.getGachaLogUrl(domain, key, queryString)

  do {
    if (gameId !== 'starrail' && page % 10 === 0) {
      sendMsg(i18n.parse(text.fetch.interval, { name, page }))
      await sleep(1)
    }
    sendMsg(i18n.parse(text.fetch.current, { name, page }))
    res = await getGachaLog({ gameId, key, page, name, url, endId, retryCount: 5 })
    await sleep(0.3)
    logs = res?.list || []
    if (!uid && logs.length && logs[0].uid) {
      uid = String(logs[0].uid)
    }
    if (!region && res?.region) {
      region = res.region
    }
    if (region_time_zone === undefined && typeof res?.region_time_zone !== 'undefined') {
      region_time_zone = res.region_time_zone
    }
    list.push(...logs)
    page += 1

    if (logs.length) {
      endId = useBigIntEndId ? BigInt(logs[logs.length - 1].id) : logs[logs.length - 1].id
    }

    const activeUid = uid || (knownUid ? String(knownUid) : '')
    if (!config.fetchFullHistory && logs.length && activeUid && map.has(activeUid)) {
      const result = map.get(activeUid).result
      if (result.has(key)) {
        const arr = result.get(key)
        if (arr && arr.length) {
          const lastItem = arr[arr.length - 1]
          const localLatestId = Array.isArray(lastItem) ? lastItem[5] : lastItem.id
          if (localLatestId) {
            if (logs.some(item => String(item.id) === String(localLatestId))) {
              break
            }
          }
        }
      }
    }
  } while (logs.length > 0)

  return { list, uid, region, region_time_zone }
}

const tryGetUid = async (queryString, gameId = config.currentGame) => {
  const adapter = getGameAdapter(gameId)
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const pageSize = adapter.pageSize || 6
  try {
    for (const [key] of adapter.defaultTypeMap) {
      const baseUrl = adapter.getGachaLogUrl(domain, key, queryString)
      const res = await request(`${baseUrl}&${adapter.queryParamKey}=${key}&page=1&size=${pageSize}`)
      checkResStatus(res, gameId)
      if (res.data && res.data.list && res.data.list.length && res.data.list[0].uid) {
        return String(res.data.list[0].uid)
      }
    }
    if (typeof adapter.getFallbackUidUrls === 'function') {
      for (const fallbackUrl of adapter.getFallbackUidUrls(domain, queryString)) {
        try {
          const res = await request(fallbackUrl)
          if (res?.retcode === 0 && res.data?.list?.length && res.data.list[0].uid) {
            return String(res.data.list[0].uid)
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return config.getGameConfig(gameId).current
}

let proxyServerCreated = false
let pendingProxyResolve = null

const ensureProxyServer = (port) => {
  return new Promise((resolve) => {
    pendingProxyResolve = resolve
    if (proxyServerCreated) return
    proxyServerCreated = true
    mitmproxy.createProxy({
      sslConnectInterceptor: (req) => {
        if (/(webstatic([^\.]{2,10})?|gs|public-operation-[^.]+|api-takumi[^.]*|sg-public-api)\.(mihoyo|hoyoverse)\.com/.test(req.url)) {
          return true
        }
      },
      requestInterceptor: (rOptions, req, res, ssl, next) => {
        next()
        if (/(webstatic([^\.]{2,10})?|gs|public-operation-[^.]+|api-takumi[^.]*|sg-public-api)\.(mihoyo|hoyoverse)\.com/.test(rOptions.hostname)) {
          if (/authkey=[^&]+/.test(rOptions.path) && pendingProxyResolve) {
            const cb = pendingProxyResolve
            pendingProxyResolve = null
            cb(`${rOptions.protocol}//${rOptions.hostname}${rOptions.path}`)
          }
        }
      },
      responseInterceptor: (req, res, proxyReq, proxyRes, ssl, next) => {
        next()
      },
      getPath: () => path.join(userPath, 'node-mitmproxy'),
      port
    })
  })
}

const useProxy = async (gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const ip = localIp()
  const port = config.proxyPort
  sendMsg(i18n.parse(text.proxy.hint, { ip, port }))
  await enableProxy('127.0.0.1', port)
  const url = await ensureProxyServer(port)
  await disableProxy()
  return url
}

const tryRequest = async (url, gameId = config.currentGame, retry = false) => {
  const adapter = getGameAdapter(gameId)
  const queryString = getQuerystring(url, gameId)
  if (!queryString) return false
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const testUrl = adapter.getValidationUrl(domain, queryString.toString())
  try {
    const res = await request(testUrl)
    checkResStatus(res, gameId)
    return true
  } catch (e) {
    if (e.code === 'ERR_PROXY_CONNECTION_FAILED' && !retry) {
      await disableProxy()
      return await tryRequest(url, gameId, true)
    }
    sendMsg(String(e.message || e).replace(url, '***'), 'ERROR')
    throw e
  }
}

const getUrl = async (gameId = config.currentGame) => {
  let url = await readLog(gameId)
  if (!url && config.proxyMode) {
    url = await useProxy(gameId)
  }
  return url
}

const getApiUrl = async (gameId = config.currentGame) => {
  const url = await getUrl(gameId)
  if (!url) return null
  const adapter = getGameAdapter(gameId)
  const searchParams = getQuerystring(url, gameId)
  if (!searchParams) return null
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const defaultPool = adapter.order[0]
  return adapter.getGachaLogUrl(domain, defaultPool, searchParams.toString())
}

const fetchData = async (urlOverride, gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const map = getDataMap(gameId)
  await readData()

  let url = urlOverride
  if (!url) {
    url = await getUrl(gameId)
  }
  if (!url) {
    const message = text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }

  await tryRequest(url, gameId)

  const searchParams = getQuerystring(url, gameId)
  if (!searchParams) {
    const message = text.url.incorrect
    sendMsg(message)
    throw new Error(message)
  }

  let queryString = searchParams.toString()
  const vUid = await tryGetUid(queryString, gameId)
  let localLang = vUid && map.has(vUid) ? map.get(vUid).lang : ''
  if (localLang) {
    localLang = adapter.formatLocalLang(localLang)
    if (localLang) {
      searchParams.set('lang', localLang)
    }
  }
  queryString = searchParams.toString()
  const rawLang = searchParams.get('lang') || config.lang
  const lang = gameId === 'beyond' ? (adapter.formatLocalLang(rawLang) || config.lang) : rawLang
  const gachaTypeMap = adapter.getGachaType(lang, detectLocale)

  const result = new Map()
  const typeMap = new Map()
  let originUid = ''
  let originRegion = ''
  let localTimeZone

  for (const [key, name] of gachaTypeMap) {
    const { list, uid, region, region_time_zone } = await getGachaLogs(gameId, [key, name], queryString, vUid)

    if (gameId === 'zzz') {
      const poolTimeZone = region ? adapter.serverTimeZone.get(region) : undefined
      if (region && poolTimeZone === undefined) {
        const errMsg = `Unsupported ZZZ server region: ${region}`
        sendMsg(errMsg)
        throw new Error(errMsg)
      }
      if (localTimeZone === undefined) {
        localTimeZone = map.get(uid)?.region_time_zone
        if (localTimeZone === undefined && poolTimeZone !== undefined) {
          localTimeZone = poolTimeZone
        }
      }
      if (poolTimeZone !== undefined && localTimeZone !== undefined) {
        list.forEach(item => {
          item.time = convertTimeZone(item.time, poolTimeZone, localTimeZone)
        })
      }
    } else if (gameId === 'starrail') {
      if (localTimeZone === undefined) {
        localTimeZone = map.get(uid)?.region_time_zone
        if (localTimeZone === undefined && region_time_zone !== undefined) {
          localTimeZone = region_time_zone
        }
      }
    } else if (gameId === 'beyond') {
      const poolTimeZone = region ? adapter.serverTimeZone?.get(region) : undefined
      if (localTimeZone === undefined) {
        const uidKey = uid || (vUid ? String(vUid) : '')
        localTimeZone = (uidKey ? map.get(uidKey)?.region_time_zone : undefined) ??
          (typeof region_time_zone === 'number' ? region_time_zone : undefined) ??
          poolTimeZone
      }
      if (poolTimeZone !== undefined && localTimeZone !== undefined && poolTimeZone !== localTimeZone) {
        list.forEach(item => {
          item.time = convertTimeZone(item.time, poolTimeZone, localTimeZone)
        })
      }
    }

    let logs
    if (gameId === 'genshin') {
      logs = list.map((item) => {
        return [item.time, item.name, item.item_type, parseInt(item.rank_type, 10), item.gacha_type, item.id]
      })
    } else if (gameId === 'beyond') {
      logs = list.map((item) => {
        const {
          id,
          schedule_id,
          op_gacha_type,
          gacha_type,
          item_id,
          item_type,
          item_name,
          name: rawName,
          rank_type,
          time,
          region: itemRegion,
          is_up,
          count
        } = item
        const itemName = item_name || rawName || ''
        const opType = String(op_gacha_type || gacha_type || key)
        return {
          id: String(id || ''),
          schedule_id: String(schedule_id || ''),
          op_gacha_type: opType,
          gacha_type: adapter.normalizePoolKey(opType),
          item_id: String(item_id || ''),
          item_type: item_type || '',
          name: itemName,
          item_name: itemName,
          rank_type: String(rank_type || ''),
          time,
          region: itemRegion || region || '',
          is_up: (typeof is_up !== 'undefined' && is_up !== null && is_up !== '') ? String(is_up) : '',
          count: count ?? '1'
        }
      })
    } else {
      logs = list.map((item) => {
        const { id, item_id, item_type, name: itemName, rank_type, time, gacha_id, gacha_type, count } = item
        return {
          id,
          item_id,
          item_type,
          name: itemName,
          rank_type: String(rank_type),
          time,
          gacha_id,
          gacha_type,
          count: count ?? '1'
        }
      })
    }

    logs.reverse()
    typeMap.set(key, name)
    result.set(key, logs)
    if (!originUid && uid) {
      originUid = uid
    }
    if (!originRegion && region) {
      originRegion = region
    }
  }

  if (!originUid) {
    originUid = vUid ? String(vUid) : ''
  }
  if (!originUid) {
    sendMsg(text.url.notFound2)
    throw new Error(text.url.notFound2)
  }

  const data = {
    result,
    typeMap,
    time: Date.now(),
    uid: originUid,
    lang,
    deleted: map.get(originUid)?.deleted || false
  }
  if (originRegion) data.region = originRegion
  if (typeof localTimeZone !== 'undefined') data.region_time_zone = localTimeZone

  const localData = map.get(originUid)
  const mergedResult = mergeData(localData, data)
  data.result = mergedResult
  map.set(originUid, data)
  await changeCurrent(originUid, gameId)
  await saveData(data, url, gameId)
}

let proxyStarted = false
const fetchDataByProxy = async (gameId = config.currentGame) => {
  if (proxyStarted) return
  proxyStarted = true
  try {
    const url = await useProxy(gameId)
    await fetchData(url, gameId)
  } finally {
    proxyStarted = false
  }
}

const getDataPayload = (gameId = config.currentGame) => {
  const map = getDataMap(gameId)
  const allAccounts = {}
  const allDataList = []
  for (const gId of GAME_IDS) {
    allAccounts[gId] = Array.from(dataMapByGame[gId].values())
      .filter(item => !item.deleted)
      .map(item => ({
        game: gId,
        uid: item.uid,
        lang: item.lang,
        time: item.time,
        count: Array.from(item.result.values()).reduce((sum, list) => sum + (list ? list.length : 0), 0)
      }))
    for (const [uid, item] of dataMapByGame[gId].entries()) {
      allDataList.push({
        game: gId,
        uid,
        time: item.time,
        deleted: Boolean(item.deleted)
      })
    }
  }
  return {
    game: gameId,
    dataMap: map,
    current: config.getGameConfig(gameId).current,
    allAccounts,
    allDataList
  }
}

if (ipcMain) {
  ipcMain.handle('FETCH_DATA', async (event, param) => {
    try {
      const targetGame = config.currentGame
      if (param === 'proxy') {
        await fetchDataByProxy(targetGame)
      } else {
        await fetchData(param, targetGame)
      }
      return getDataPayload(targetGame)
    } catch (e) {
      sendMsg(e, 'ERROR')
      console.error(e)
    }
    return false
  })

  ipcMain.handle('READ_DATA', async () => {
    await readData()
    return getDataPayload(config.currentGame)
  })

  ipcMain.handle('FORCE_READ_DATA', async () => {
    await readData(true)
    return getDataPayload(config.currentGame)
  })

  ipcMain.handle('SWITCH_GAME', async (event, gameId) => {
    await readData()
    return await switchGame(gameId)
  })

  ipcMain.handle('CHANGE_UID', async (event, uid, gameId) => {
    await changeCurrent(uid, gameId || config.currentGame)
  })

  ipcMain.handle('GET_CONFIG', async () => {
    if (config.ready) await config.ready
    return config.value()
  })

  ipcMain.handle('LANG_MAP', () => {
    return langMap
  })

  ipcMain.handle('SAVE_CONFIG', async (event, [key, value]) => {
    config[key] = value
    await config.save()
  })

  ipcMain.handle('DISABLE_PROXY', async () => {
    await disableProxy()
  })

  ipcMain.handle('I18N_DATA', () => {
    return i18n.forGame(config.currentGame, config.lang)
  })

  ipcMain.handle('OPEN_CACHE_FOLDER', () => {
    const folder = cacheFolderByGame[config.currentGame]
    if (folder) {
      shell.openPath(folder)
    }
  })
}

exports.getData = (gameId = config.currentGame) => {
  return {
    game: gameId,
    dataMap: getDataMap(gameId),
    current: config.getGameConfig(gameId).current
  }
}

exports.getDataPayload = getDataPayload
exports.getAllDataMaps = () => dataMapByGame
exports.getGachaType = (lang, gameId = config.currentGame) => {
  return getGameAdapter(gameId).getGachaType(lang, detectLocale)
}
exports.readData = readData
exports.getUrl = getUrl
exports.getApiUrl = getApiUrl
exports.getQuerystring = getQuerystring
exports.normalizeLoadedData = normalizeLoadedData
exports.deleteData = deleteData
exports.saveData = saveData
exports.changeCurrent = changeCurrent
exports.switchGame = switchGame
exports.convertTimeZone = convertTimeZone
exports.migrateLegacyFiles = migrateLegacyFiles
