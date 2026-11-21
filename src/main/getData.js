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
const { mergeData, mergeList, mergeMultisetList } = require('./utils/mergeData')
const { GAME_IDS, getGameAdapter, detectDataGame } = require('../games/registry')

const dataMapByGame = {}
const cacheFolderByGame = {}
const apiDomainByGame = {}
for (const gameId of GAME_IDS) {
  dataMapByGame[gameId] = new Map()
  cacheFolderByGame[gameId] = null
  apiDomainByGame[gameId] = getGameAdapter(gameId).defaultApiDomain || ''
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
  } else if (gameId === 'bh3') {
    const normalizedResult = new Map()
    data.result.forEach((value, rawKey) => {
      if (!Array.isArray(value)) return
      const poolKey = String(rawKey)
      const mapped = value.map(item => {
        if (!item || typeof item !== 'object') return item
        const itemName = item.name || item.item_name || ''
        const itemType = item.item_type || ''
        return {
          ...item,
          gacha_type: String(item.gacha_type || poolKey),
          time: String(item.time || ''),
          name: itemName,
          item_type: itemType,
          rank_type: String(item.rank_type || '3'),
          raw_content: item.raw_content || (itemType ? `[${itemType}]${itemName}` : itemName),
          count: String(item.count ?? '1')
        }
      })
      const hasMissingId = mapped.some(item => !item?.id)
      normalizedResult.set(poolKey, hasMissingId ? mergeMultisetList([], mapped, poolKey) : mapped)
    })
    data.result = normalizedResult
  } else if (gameId === 'starrail_blindbox') {
    const normalizedResult = new Map()
    data.result.forEach((value, rawKey) => {
      if (!Array.isArray(value)) return
      const poolKey = String(rawKey || '1001')
      const mapped = value.map(item => {
        if (!item || typeof item !== 'object') return item
        const itemName = item.item_name || item.name || ''
        const subRarity = item.blind_box_sub_rarity != null ? String(item.blind_box_sub_rarity) : ''
        const rankType = subRarity && adapter.mapBlindBoxRarity
          ? adapter.mapBlindBoxRarity(subRarity, item.rank_type)
          : String(item.rank_type || '3')
        return {
          ...item,
          id: String(item.id || ''),
          pool_id: String(item.pool_id || poolKey),
          gacha_id: String(item.gacha_id || item.pool_id || poolKey),
          gacha_type: String(item.gacha_type || item.pool_id || poolKey),
          item_id: String(item.item_id || ''),
          item_type: item.item_type || item.type_name || '',
          name: itemName,
          item_name: itemName,
          blind_box_sub_rarity: subRarity,
          rank_type: rankType,
          count: String(item.count ?? '1')
        }
      })
      normalizedResult.set(poolKey, mapped)
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
      if (!/^gacha-list-[A-Za-z0-9_-]+\.json$/.test(name)) continue
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
    const currentUid = gameCfg.current ? String(gameCfg.current) : ''
    const currentEntry = currentUid ? map.get(currentUid) : null
    const activeEntries = Array.from(map.entries()).filter(([, d]) => !d.deleted)
    if (
      (!currentUid && activeEntries.length) ||
      (currentUid && (!currentEntry || currentEntry.deleted))
    ) {
      const nextUid = activeEntries.length ? activeEntries[0][0] : 0
      config.setGameConfig(gameId, 'current', nextUid)
      await config.save()
    }
  }
}

const deleteData = async (uid, action, gameId = config.currentGame) => {
  const map = getDataMap(gameId)
  const targetUid = String(uid)
  const data = map.get(targetUid)
  if (data) {
    data.deleted = action
    const currentUid = String(config.getGameConfig(gameId).current || '')
    if (action && currentUid === targetUid) {
      const activeEntries = Array.from(map.entries()).filter(([, d]) => !d.deleted)
      const nextUid = activeEntries.length ? activeEntries[0][0] : 0
      config.setGameConfig(gameId, 'current', nextUid)
    } else if (!action && (!currentUid || currentUid === '0')) {
      config.setGameConfig(gameId, 'current', targetUid)
    }
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
  if (adapter.availability === 'pending' || !adapter.urlRegex) {
    sendMsg(text.pending?.notSupported || text.file.notFound)
    return false
  }
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
      // Fallback: some clients (e.g. BH3) may write service-center URLs directly to output_log.txt
      const directLogMatch = logText.match(adapter.urlRegex)
      if (directLogMatch && directLogMatch.length) {
        return { primary: null, fallback: getLatestUrl(directLogMatch) }
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
  const mr = url.match(/authkey=([^&#]+)/)
  if (mr && mr[1] && mr[1].includes('=') && !mr[1].includes('%')) {
    return url.replace(/authkey=([^&#]+)/, `authkey=${encodeURIComponent(mr[1])}`)
  }
  return url
}

const getQuerystring = (url, gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  if (adapter.availability === 'pending') {
    sendMsg(text.pending?.notSupported || text.url.incorrect)
    return false
  }
  let parsed
  try {
    parsed = new URL(fixAuthkey(String(url || '').trim()))
  } catch (e) {
    sendMsg(text.url.incorrect)
    return false
  }
  const { searchParams, host } = parsed
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
  if (!res || res.retcode !== 0) {
    let message = res?.message || 'Unknown API error'
    if (
      res?.retcode === -100 ||
      res?.retcode === -101 ||
      /authkey/i.test(String(res?.message || ''))
    ) {
      message = text.fetch?.authTimeout || message
      sendMsg(true, 'AUTHKEY_TIMEOUT')
    } else if ([1034, 10035, 10041].includes(res?.retcode)) {
      message = text.fetch?.captcha || message
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
  if (adapter.availability === 'pending') return ''
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const pageSize = adapter.pageSize || 6
  const headers = adapter.getRequestHeaders ? adapter.getRequestHeaders(domain) : undefined
  const reqOpts = headers ? { headers } : undefined

  if (adapter.fetchStrategy === 'blindbox') {
    try {
      const baseUrl = adapter.getGachaLogUrl(domain, '1001', queryString)
      const res = await request(`${baseUrl}&page=1&size=${pageSize}&max_id=0`, reqOpts)
      if (res?.retcode === 0 && res.data?.list?.length && res.data.list[0].uid) {
        return String(res.data.list[0].uid)
      }
    } catch (e) {}
  } else if (adapter.fetchStrategy !== 'bh3_self_help') {
    for (const [key] of adapter.defaultTypeMap) {
      try {
        const baseUrl = adapter.getGachaLogUrl(domain, key, queryString)
        const res = await request(`${baseUrl}&${adapter.queryParamKey}=${key}&page=1&size=${pageSize}&end_id=0`, reqOpts)
        if (res?.retcode === 0 && res.data?.list?.length && res.data.list[0].uid) {
          return String(res.data.list[0].uid)
        }
      } catch (e) {}
    }
  }
  if (typeof adapter.getFallbackUidUrls === 'function') {
    for (const fallbackUrl of adapter.getFallbackUidUrls(domain, queryString)) {
      try {
        const res = await request(fallbackUrl, reqOpts)
        if (res?.retcode === 0 && res.data?.list?.length && res.data.list[0].uid) {
          return String(res.data.list[0].uid)
        }
      } catch (e) {}
    }
  }
  return ''
}

let proxyServerCreated = false
let pendingProxyResolve = null

const PROXY_HOST_RE = /(webstatic([^\.]{2,10})?|gs|act|cs|public-operation-[^.]+|api-takumi[^.]*|sg-public-api)\.(mihoyo|hoyoverse)\.com/

const ensureProxyServer = (port) => {
  return new Promise((resolve) => {
    pendingProxyResolve = resolve
    if (proxyServerCreated) return
    proxyServerCreated = true
    mitmproxy.createProxy({
      sslConnectInterceptor: (req) => {
        if (PROXY_HOST_RE.test(req.url)) {
          return true
        }
      },
      requestInterceptor: (rOptions, req, res, ssl, next) => {
        next()
        if (PROXY_HOST_RE.test(rOptions.hostname)) {
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
  const adapter = getGameAdapter(gameId)
  const text = i18n.forGame(gameId, config.lang).log
  if (adapter.availability === 'pending') {
    const message = text.pending?.notSupported || text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }
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
  if (adapter.availability === 'pending') {
    const text = i18n.forGame(gameId, config.lang).log
    const message = text.pending?.notSupported || text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }
  const queryString = getQuerystring(url, gameId)
  if (!queryString) return false
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const testUrl = adapter.getValidationUrl(domain, queryString.toString())
  const headers = adapter.getRequestHeaders ? adapter.getRequestHeaders(domain) : undefined
  try {
    const res = await request(testUrl, headers ? { headers } : undefined)
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
  const adapter = getGameAdapter(gameId)
  if (adapter.availability === 'pending') {
    const text = i18n.forGame(gameId, config.lang).log
    sendMsg(text.pending?.notSupported || text.url.notFound)
    return false
  }
  let url = await readLog(gameId)
  if (!url && config.proxyMode) {
    url = await useProxy(gameId)
  }
  return url
}

const getApiUrl = async (gameId = config.currentGame) => {
  const adapter = getGameAdapter(gameId)
  if (adapter.availability === 'pending') return null
  const url = await getUrl(gameId)
  if (!url) return null
  const searchParams = getQuerystring(url, gameId)
  if (!searchParams) return null
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const defaultPool = adapter.order[0]
  return adapter.getGachaLogUrl(domain, defaultPool, searchParams.toString())
}

const BH3_WIKI_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const loadBh3WikiRankMap = async (adapter = getGameAdapter('bh3')) => {
  const bh3Dir = getGameDataPath('bh3')
  const cacheFile = 'wiki-rank-cache.json'
  let cached = null
  try {
    cached = await readJSON(bh3Dir, cacheFile)
    if (
      cached &&
      typeof cached.updatedAt === 'number' &&
      Date.now() - cached.updatedAt < BH3_WIKI_CACHE_TTL_MS &&
      cached.characters &&
      cached.weapons
    ) {
      return cached
    }
  } catch (e) {}

  const rankMap = {
    updatedAt: Date.now(),
    characters: {},
    weapons: {},
    stigmata: {}
  }

  let fetchedAny = false
  const channels = Array.isArray(adapter.wikiChannels) ? adapter.wikiChannels : ['18', '20', '19']
  for (const cid of channels) {
    try {
      const url = adapter.getWikiChannelUrl(cid)
      if (!url) continue
      const res = await request(url, { timeout: 8000 })
      if (res && res.retcode === 0) {
        const parsed = adapter.parseBh3WikiChannelItems(cid, res)
        if (String(cid) === '18') Object.assign(rankMap.characters, parsed)
        else if (String(cid) === '20') Object.assign(rankMap.weapons, parsed)
        else if (String(cid) === '19') Object.assign(rankMap.stigmata, parsed)
        fetchedAny = true
      }
    } catch (e) {}
  }

  if (fetchedAny) {
    try {
      await saveJSON(cacheFile, rankMap, 'bh3')
    } catch (e) {}
    return rankMap
  }
  return cached || rankMap
}

const extractBh3MenuList = (res) => {
  if (!res || !res.data) return []
  if (Array.isArray(res.data)) return res.data
  if (Array.isArray(res.data.list)) return res.data.list
  if (Array.isArray(res.data.menus)) return res.data.menus
  return []
}

const fetchBh3Data = async (url, searchParams, gameId = 'bh3') => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const map = getDataMap(gameId)
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain
  const headers = adapter.getRequestHeaders ? adapter.getRequestHeaders(domain) : undefined
  const reqOpts = headers ? { headers } : undefined

  const initialType = searchParams.get('type') || ''
  searchParams.delete('type')
  if (!searchParams.get('page_id')) {
    searchParams.set('page_id', adapter.getDefaultPageId(domain, searchParams.get('game_biz')))
  }
  const baseQueryString = searchParams.toString()

  sendMsg(text.fetch?.gachaType || 'Getting supply pools')
  const explicitMenus = []
  const bareMenus = []
  const seenRawTypes = new Set()
  let apiUid = ''

  for (const probeType of ['2', '3', '1', '4', '5', '6']) {
    const menuUrl = adapter.getMenusUrl(domain, baseQueryString, probeType)
    let res
    try {
      res = await request(menuUrl, reqOpts)
    } catch (e) {
      if (e.code === 'ERR_PROXY_CONNECTION_FAILED') {
        await disableProxy()
        res = await request(menuUrl, reqOpts)
      } else {
        continue
      }
    }
    if (!res) continue
    if (res.retcode !== 0) {
      if (
        res.retcode === -100 ||
        res.retcode === -101 ||
        [1034, 10035, 10041].includes(res.retcode) ||
        /authkey/i.test(String(res.message || ''))
      ) {
        checkResStatus(res, gameId)
      }
      continue
    }
    if (!apiUid && (res.data?.uid || res.data?.role_id)) {
      apiUid = String(res.data.uid || res.data.role_id)
    }
    const items = extractBh3MenuList(res)
    for (const m of items) {
      const label = String(m?.label || m?.name || m?.title || '').trim()
      const rawType = String(m?.type ?? m?.id ?? m?.value ?? '').trim()
      if (!label || !rawType || seenRawTypes.has(rawType)) continue
      if (adapter.isValidBh3MenuName(label, false)) {
        seenRawTypes.add(rawType)
        explicitMenus.push({ type: rawType, label })
      } else if (adapter.isBareBh3CategoryMenuName(label)) {
        seenRawTypes.add(rawType)
        bareMenus.push({ type: rawType, label })
      }
    }
  }

  let menus = explicitMenus.length ? explicitMenus : bareMenus
  if (!menus.length && initialType) {
    menus = [{ type: initialType, label: `补给 ${initialType}` }]
  }
  if (!menus.length) {
    const message = text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }
  sendMsg(text.fetch?.gachaTypeOk || 'Supply pools acquired')

  sendMsg(text.fetch?.wikiRank || 'Syncing wiki rank table')
  const wikiRankMap = await loadBh3WikiRankMap(adapter)

  const rawLang = searchParams.get('lang') || config.lang
  const lang = adapter.formatLocalLang(rawLang) || config.lang || 'zh-cn'
  const localizedTypeMap = adapter.getGachaType(lang, detectLocale)

  const result = new Map()
  const typeMap = new Map()
  const pageSize = adapter.pageSize || 20
  const baseLogUrl = adapter.getGachaLogUrl(domain, '', baseQueryString)

  for (const menu of menus) {
    const poolKey = adapter.normalizeBh3PoolKey(menu.label, menu.type)
    const displayName = localizedTypeMap.get(poolKey) || menu.label
    typeMap.set(poolKey, displayName)

    const fetched = []
    let page = 1
    let pageList = []

    do {
      if (page % 10 === 0) {
        sendMsg(i18n.parse(text.fetch.interval, { name: displayName, page }))
        await sleep(1)
      }
      sendMsg(i18n.parse(text.fetch.current, { name: displayName, page }))

      let res = null
      let lastErr = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await request(
            `${baseLogUrl}&type=${encodeURIComponent(menu.type)}&page=${page}&size=${pageSize}&end_id=0`,
            reqOpts
          )
          checkResStatus(res, gameId)
          lastErr = null
          break
        } catch (err) {
          lastErr = err
          if (
            err.message === text.fetch?.authTimeout ||
            err.message === text.fetch?.captcha
          ) {
            throw err
          }
          if (attempt < 2) {
            sendMsg(i18n.parse(text.fetch.retry, { name: displayName, page, count: attempt + 1 }))
            await sleep(2)
          }
        }
      }
      if (lastErr) {
        sendMsg(i18n.parse(text.fetch.retryFailed, { name: displayName, page }))
        throw lastErr
      }

      if (!apiUid && (res?.data?.uid || res?.data?.role_id)) {
        apiUid = String(res.data.uid || res.data.role_id)
      }

      pageList = Array.isArray(res?.data?.list) ? res.data.list : []
      for (const entry of pageList) {
        const parsed = adapter.parseBh3ApiRecord(entry)
        if (!parsed || !parsed.name) continue
        const rankType = parsed.rank_type || adapter.resolveBh3Rank(parsed.item_type, parsed.name, wikiRankMap)
        fetched.push({
          gacha_type: poolKey,
          pool_name: displayName,
          raw_type: String(menu.type),
          time: parsed.time,
          name: parsed.name,
          item_type: parsed.item_type,
          rank_type: String(rankType),
          raw_content: parsed.raw_content,
          count: '1'
        })
      }

      page += 1
      if (pageList.length >= 10) {
        await sleep(0.15)
      }
    } while (pageList.length >= 10)

    fetched.reverse()
    const existingPool = result.get(poolKey) || []
    result.set(poolKey, existingPool.concat(fetched))
  }

  const originUid = String(
    searchParams.get('community_select_uid') ||
    searchParams.get('uid') ||
    searchParams.get('game_uid') ||
    searchParams.get('role_id') ||
    apiUid ||
    `${searchParams.get('game_biz') || 'bh3_cn'}_default`
  )

  const localData = map.get(originUid)
  const mergedTypeMap = new Map(localData?.typeMap instanceof Map ? localData.typeMap : [])
  for (const [k, v] of typeMap.entries()) {
    mergedTypeMap.set(k, v)
  }

  const data = {
    result,
    typeMap: mergedTypeMap,
    time: Date.now(),
    uid: originUid,
    lang,
    deleted: localData?.deleted || false
  }

  data.result = mergeData(localData, data, { multiset: true })
  map.set(originUid, data)
  await changeCurrent(originUid, gameId)
  await saveData(data, url, gameId)
}

const fetchBlindBoxData = async (url, searchParams, gameId = 'starrail_blindbox') => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  const map = getDataMap(gameId)
  const domain = apiDomainByGame[gameId] || adapter.defaultApiDomain

  await tryRequest(url, gameId)

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
  const lang = adapter.formatLocalLang(rawLang) || config.lang || 'zh-cn'
  const defaultLocalizedTypeMap = adapter.getGachaType(lang, detectLocale)

  const knownLocalIds = new Set()
  const existingAccount = vUid ? map.get(vUid) : null
  if (!config.fetchFullHistory && existingAccount?.result instanceof Map) {
    for (const arr of existingAccount.result.values()) {
      if (!Array.isArray(arr)) continue
      for (const item of arr) {
        if (item && item.id) knownLocalIds.add(String(item.id))
      }
    }
  }

  const pageSize = adapter.pageSize || 5
  const baseUrl = adapter.getGachaLogUrl(domain, '1001', queryString)
  const displayName = defaultLocalizedTypeMap.get('1001') || '星际潮玩'
  let page = 1
  let maxId = '0'
  let logs = []
  let originUid = ''
  let originRegion = ''
  let localTimeZone
  const fetchedAll = []

  do {
    if (page % 10 === 0) {
      sendMsg(i18n.parse(text.fetch.interval, { name: displayName, page }))
      await sleep(1)
    }
    sendMsg(i18n.parse(text.fetch.current, { name: displayName, page }))

    let res = null
    let lastErr = null
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        res = await request(`${baseUrl}&page=${page}&size=${pageSize}&max_id=${maxId}`)
        checkResStatus(res, gameId)
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        if (err.message === text.fetch?.authTimeout) {
          throw err
        }
        if (attempt < 4) {
          sendMsg(i18n.parse(text.fetch.retry, { name: displayName, page, count: attempt + 1 }))
          await sleep(5)
        }
      }
    }
    if (lastErr) {
      sendMsg(i18n.parse(text.fetch.retryFailed, { name: displayName, page }))
      throw lastErr
    }

    const resData = res?.data || {}
    logs = Array.isArray(resData.list) ? resData.list : []
    if (!originRegion && resData.region) {
      originRegion = resData.region
    }
    if (localTimeZone === undefined && typeof resData.region_time_zone !== 'undefined') {
      localTimeZone = resData.region_time_zone
    }
    if (!originUid && logs.length && logs[0].uid) {
      originUid = String(logs[0].uid)
    }
    fetchedAll.push(...logs)
    page += 1

    if (logs.length) {
      const lastId = String(logs[logs.length - 1].id || '0')
      maxId = /^\d+$/.test(lastId) ? BigInt(lastId).toString() : lastId
    }

    if (!config.fetchFullHistory && knownLocalIds.size && logs.some(item => knownLocalIds.has(String(item.id)))) {
      break
    }

    if (logs.length > 0) {
      await sleep(0.2)
    }
  } while (logs.length > 0)

  if (!originUid) {
    originUid = String(vUid || searchParams.get('uid') || '')
  }
  if (!originUid) {
    sendMsg(text.url.notFound2)
    throw new Error(text.url.notFound2)
  }

  const grouped = new Map()
  const typeMap = new Map(defaultLocalizedTypeMap)

  for (const item of fetchedAll) {
    const poolId = String(item.pool_id || '1001')
    if (!grouped.has(poolId)) {
      grouped.set(poolId, [])
    }
    if (!typeMap.has(poolId)) {
      typeMap.set(poolId, `${displayName} (${poolId})`)
    }
    const subRarity = item.blind_box_sub_rarity != null ? String(item.blind_box_sub_rarity) : ''
    const rankType = adapter.mapBlindBoxRarity(subRarity, item.rank_type)
    const itemName = item.item_name || item.name || ''
    grouped.get(poolId).push({
      id: String(item.id || ''),
      pool_id: poolId,
      gacha_id: poolId,
      gacha_type: poolId,
      item_id: String(item.item_id || ''),
      item_type: item.type_name || item.item_type || '',
      name: itemName,
      item_name: itemName,
      rank_type: rankType,
      blind_box_sub_rarity: subRarity,
      pet_id: item.pet_id != null ? String(item.pet_id) : '',
      chroma_appearance_id: item.chroma_appearance_id != null ? String(item.chroma_appearance_id) : '',
      pet_type: item.pet_type != null ? String(item.pet_type) : '',
      time: item.time,
      count: '1'
    })
  }

  const result = new Map()
  for (const [poolId, poolLogs] of grouped.entries()) {
    poolLogs.reverse()
    result.set(poolId, poolLogs)
  }

  const localData = map.get(originUid)
  if (localTimeZone === undefined && typeof localData?.region_time_zone !== 'undefined') {
    localTimeZone = localData.region_time_zone
  }
  const mergedTypeMap = new Map(localData?.typeMap instanceof Map ? localData.typeMap : [])
  for (const [k, v] of typeMap.entries()) {
    mergedTypeMap.set(k, v)
  }

  const data = {
    result,
    typeMap: mergedTypeMap,
    time: Date.now(),
    uid: originUid,
    lang,
    deleted: localData?.deleted || false
  }
  if (originRegion) data.region = originRegion
  if (typeof localTimeZone !== 'undefined') data.region_time_zone = localTimeZone

  data.result = mergeData(localData, data)
  map.set(originUid, data)
  await changeCurrent(originUid, gameId)
  await saveData(data, url, gameId)
}

const fetchData = async (urlOverride, gameId = config.currentGame) => {
  const text = i18n.forGame(gameId, config.lang).log
  const adapter = getGameAdapter(gameId)
  if (adapter.availability === 'pending') {
    const message = text.pending?.notSupported || text.url.notFound2
    sendMsg(message)
    throw new Error(message)
  }
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

  const searchParams = getQuerystring(url, gameId)
  if (!searchParams) {
    const message = text.url.incorrect
    sendMsg(message)
    throw new Error(message)
  }

  if (adapter.fetchStrategy === 'bh3_self_help') {
    await fetchBh3Data(url, searchParams, gameId)
    return
  }

  if (adapter.fetchStrategy === 'blindbox') {
    await fetchBlindBoxData(url, searchParams, gameId)
    return
  }

  await tryRequest(url, gameId)

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
exports.tryGetUid = tryGetUid
exports.fetchData = fetchData
exports.loadBh3WikiRankMap = loadBh3WikiRankMap
exports.PROXY_HOST_RE = PROXY_HOST_RE
