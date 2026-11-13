const {
  readJSON,
  saveJSON,
  decipherAes,
  cipherAes,
  detectLocale,
  userDataPath,
  cloneDeep
} = require('./utils')
const { GAME_IDS } = require('../games/registry')

const createDefaultGameConfig = () => ({
  current: 0,
  urls: [],
  logType: 0,
  hideHiddenPool: false
})

const config = {
  currentGame: 'genshin',
  lang: detectLocale(),
  proxyPort: 8325,
  proxyMode: false,
  autoUpdate: true,
  fetchFullHistory: false,
  readableJSON: false,
  uigfVersion: '4.1',
  uigfAllAccounts: true,
  games: {
    genshin: createDefaultGameConfig(),
    starrail: createDefaultGameConfig(),
    zzz: createDefaultGameConfig()
  }
}

const urlsMaps = {
  genshin: new Map(),
  starrail: new Map(),
  zzz: new Map()
}

const decryptUrlPairs = (pairs = []) => {
  const result = []
  if (!Array.isArray(pairs)) return result
  for (const item of pairs) {
    if (!Array.isArray(item) || item.length < 2) continue
    try {
      result.push([item[0], item[1] ? decipherAes(item[1]) : ''])
    } catch (e) {
      result.push([item[0], ''])
    }
  }
  return result
}

const encryptUrlPairs = (map) => {
  const result = []
  for (const [uid, url] of map.entries()) {
    try {
      result.push([uid, url ? cipherAes(url) : ''])
    } catch (e) {
      result.push([uid, ''])
    }
  }
  return result
}

const applyGameConfig = (gameId, source) => {
  if (!source || typeof source !== 'object') return
  const target = config.games[gameId]
  if (typeof source.current !== 'undefined') target.current = source.current
  if (typeof source.logType !== 'undefined') target.logType = Number(source.logType) || 0
  if (typeof source.hideHiddenPool !== 'undefined') {
    target.hideHiddenPool = Boolean(source.hideHiddenPool)
  } else if (typeof source.hideNovice !== 'undefined') {
    target.hideHiddenPool = Boolean(source.hideNovice)
  } else if (typeof source.hideStandard !== 'undefined') {
    target.hideHiddenPool = Boolean(source.hideStandard)
  }
  if (Array.isArray(source.urls)) {
    const decrypted = decryptUrlPairs(source.urls)
    target.urls = decrypted
    urlsMaps[gameId] = new Map(decrypted)
  }
}

let configReadyPromise = null
const getLocalConfig = async () => {
  const localConfig = await readJSON(userDataPath, 'config.json')
  if (!localConfig || typeof localConfig !== 'object') return

  const sharedKeys = ['currentGame', 'lang', 'proxyPort', 'proxyMode', 'autoUpdate', 'fetchFullHistory', 'readableJSON', 'uigfVersion', 'uigfAllAccounts']
  for (const key of sharedKeys) {
    if (typeof localConfig[key] !== 'undefined') {
      config[key] = localConfig[key]
    }
  }
  if (!GAME_IDS.includes(config.currentGame)) {
    config.currentGame = 'genshin'
  }

  if (localConfig.games && typeof localConfig.games === 'object') {
    for (const gameId of GAME_IDS) {
      applyGameConfig(gameId, localConfig.games[gameId])
    }
  } else {
    // Legacy single-game config.json migration
    const inferredGame = typeof localConfig.hideStandard !== 'undefined' ? 'zzz' : config.currentGame
    applyGameConfig(inferredGame, localConfig)
    config.currentGame = inferredGame
  }
}

configReadyPromise = getLocalConfig()

const GAME_SCOPED_KEYS = new Set(['current', 'logType', 'hideHiddenPool', 'hideNovice', 'hideStandard'])

const setConfig = (key, value) => {
  if (key === 'currentGame') {
    if (GAME_IDS.includes(value)) {
      config.currentGame = value
    }
    return
  }
  if (GAME_SCOPED_KEYS.has(key)) {
    const gameCfg = config.games[config.currentGame]
    if (key === 'hideNovice' || key === 'hideStandard') {
      gameCfg.hideHiddenPool = Boolean(value)
    } else if (key === 'logType') {
      gameCfg.logType = Number(value) || 0
    } else {
      gameCfg[key] = value
    }
    return
  }
  if (typeof config[key] !== 'undefined') {
    config[key] = value
  }
}

const getGameConfig = (gameId = config.currentGame) => {
  return config.games[GAME_IDS.includes(gameId) ? gameId : 'genshin']
}

const setGameConfig = (gameId, key, value) => {
  const gameCfg = getGameConfig(gameId)
  if (key === 'hideNovice' || key === 'hideStandard' || key === 'hideHiddenPool') {
    gameCfg.hideHiddenPool = Boolean(value)
  } else {
    gameCfg[key] = value
  }
}

const saveConfig = async () => {
  const snapshot = cloneDeep(config)
  for (const gameId of GAME_IDS) {
    snapshot.games[gameId].urls = encryptUrlPairs(urlsMaps[gameId])
  }
  await saveJSON('config.json', snapshot)
}

const getPlainConfig = () => {
  const active = getGameConfig(config.currentGame)
  return {
    currentGame: config.currentGame,
    lang: config.lang,
    proxyPort: config.proxyPort,
    proxyMode: config.proxyMode,
    autoUpdate: config.autoUpdate,
    fetchFullHistory: config.fetchFullHistory,
    readableJSON: config.readableJSON,
    uigfVersion: config.uigfVersion,
    uigfAllAccounts: config.uigfAllAccounts,
    current: active.current,
    logType: active.logType,
    hideHiddenPool: active.hideHiddenPool,
    hideNovice: active.hideHiddenPool,
    hideStandard: active.hideHiddenPool,
    games: {
      genshin: {
        current: config.games.genshin.current,
        logType: config.games.genshin.logType,
        hideHiddenPool: config.games.genshin.hideHiddenPool
      },
      starrail: {
        current: config.games.starrail.current,
        logType: config.games.starrail.logType,
        hideHiddenPool: config.games.starrail.hideHiddenPool
      },
      zzz: {
        current: config.games.zzz.current,
        logType: config.games.zzz.logType,
        hideHiddenPool: config.games.zzz.hideHiddenPool
      }
    }
  }
}

const configProxy = new Proxy(config, {
  get(obj, prop) {
    if (prop === 'ready') {
      return configReadyPromise
    }
    if (prop === 'urls') {
      return urlsMaps[obj.currentGame]
    }
    if (prop === 'getUrlsMap') {
      return (gameId = obj.currentGame) => urlsMaps[gameId]
    }
    if (prop === 'current') {
      return obj.games[obj.currentGame].current
    }
    if (prop === 'logType') {
      return obj.games[obj.currentGame].logType
    }
    if (prop === 'hideHiddenPool' || prop === 'hideNovice' || prop === 'hideStandard') {
      return obj.games[obj.currentGame].hideHiddenPool
    }
    if (prop === 'set') {
      return setConfig
    }
    if (prop === 'save') {
      return saveConfig
    }
    if (prop === 'value') {
      return getPlainConfig
    }
    if (prop === 'getGameConfig') {
      return getGameConfig
    }
    if (prop === 'setGameConfig') {
      return setGameConfig
    }
    if (prop === 'reload') {
      return getLocalConfig
    }
    return obj[prop]
  },
  set(obj, prop, value) {
    setConfig(prop, value)
    return true
  }
})

module.exports = configProxy
