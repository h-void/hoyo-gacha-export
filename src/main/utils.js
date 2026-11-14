const fs = require('fs-extra')
const path = require('path')
const fetch = require('electron-fetch').default
const electron = process.versions.electron ? require('electron') : {}
const electronObj = (typeof electron === 'object' && electron !== null) ? electron : {}
const { BrowserWindow, app } = electronObj
const crypto = require('crypto')
const util = require('util')
const { glob } = require('glob')
const os = require('os')

const readdir = util.promisify(fs.readdir)

const isDev = app ? !app.isPackaged : true

const appRoot = isDev
  ? path.resolve(__dirname, '..', '..')
  : path.resolve(app.getAppPath(), '..', '..')
const userDataPath = process.env.HOYO_USER_DATA_PATH
  ? path.resolve(process.env.HOYO_USER_DATA_PATH)
  : path.resolve(appRoot, 'userData')
const userPath = app ? app.getPath('userData') : path.resolve(userDataPath, '.electron-user')

function debounce(fn, wait = 300) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, wait)
  }
}

function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function cloneDeep(value) {
  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item))
  }
  if (value instanceof Map) {
    const out = new Map()
    for (const [k, v] of value.entries()) {
      out.set(k, cloneDeep(v))
    }
    return out
  }
  if (isPlainObject(value)) {
    const out = {}
    for (const key of Object.keys(value)) {
      out[key] = cloneDeep(value[key])
    }
    return out
  }
  return value
}

let win = null
const initWindow = () => {
  if (!BrowserWindow) return null
  const windowStateKeeper = require('electron-window-state')
  const mainWindowState = windowStateKeeper({
    defaultWidth: 920,
    defaultHeight: 580
  })
  win = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  })
  const saveState = debounce(mainWindowState.saveState, 500)
  win.on('resize', () => saveState(win))
  win.on('move', () => saveState(win))
  return win
}

const getWin = () => win

const log = []
const sendMsg = (text, type = 'LOAD_DATA_STATUS') => {
  if (win && !win.isDestroyed()) {
    win.webContents.send(type, text)
  }
  if (type !== 'LOAD_DATA_STATUS') {
    log.push([Date.now(), type, text])
    saveLog()
  }
}

const saveLog = () => {
  try {
    const text = log.map(item => {
      const time = new Date(item[0]).toLocaleString()
      const type = item[1] === 'LOAD_DATA_STATUS' ? 'INFO' : item[1]
      const msg = item[2] instanceof Error ? authkeyMask(item[2].stack || item[2].message) : authkeyMask(String(item[2] || ''))
      return `[${type}][${time}]${msg}`
    }).join('\r\n')
    fs.outputFile(path.join(userDataPath, 'log.txt'), text)
  } catch (e) {}
}

const authkeyMask = (text = '') => {
  return String(text).replace(/authkey=[^&\s]+/g, 'authkey=***')
}

if (app) {
  const unhandled = require('electron-unhandled')
  unhandled({
    showDialog: false,
    logger: function (err) {
      log.push([Date.now(), 'ERROR', authkeyMask(err.stack || err.message)])
      saveLog()
    }
  })
}

const request = async (url) => {
  const res = await fetch(url, {
    timeout: 15 * 1000
  })
  return await res.json()
}

const sleep = (sec = 1) => {
  return new Promise(rev => {
    setTimeout(rev, sec * 1000)
  })
}

const convertTimeZone = (dateTimeStr, fromTimeZoneOffset, toTimeZoneOffset) => {
  if (fromTimeZoneOffset === undefined || toTimeZoneOffset === undefined || fromTimeZoneOffset === toTimeZoneOffset) {
    return dateTimeStr
  }
  const date = new Date(String(dateTimeStr).replace(' ', 'T') + 'Z')
  if (Number.isNaN(date.getTime())) return dateTimeStr
  const utcDate = new Date(date.getTime() - Number(fromTimeZoneOffset) * 60 * 60 * 1000)
  const targetDate = new Date(utcDate.getTime() + Number(toTimeZoneOffset) * 60 * 60 * 1000)
  const year = targetDate.getUTCFullYear()
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getUTCDate()).padStart(2, '0')
  const hours = String(targetDate.getUTCHours()).padStart(2, '0')
  const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0')
  const seconds = String(targetDate.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

const langMap = new Map([
  ['zh-cn', '简体中文'],
  ['zh-tw', '繁體中文'],
  ['de-de', 'Deutsch'],
  ['en-us', 'English'],
  ['es-es', 'Español'],
  ['fr-fr', 'Français'],
  ['id-id', 'Indonesia'],
  ['ja-jp', '日本語'],
  ['ko-kr', '한국어'],
  ['pt-pt', 'Português'],
  ['ru-ru', 'Pусский'],
  ['th-th', 'ภาษาไทย'],
  ['vi-vn', 'Tiếng Việt']
])

const localeMap = new Map([
  ['zh-cn', ['zh', 'zh-CN']],
  ['zh-tw', ['zh-TW', 'zh-HK']],
  ['de-de', ['de-AT', 'de-CH', 'de-DE', 'de']],
  ['en-us', ['en-AU', 'en-CA', 'en-GB', 'en-NZ', 'en-US', 'en-ZA', 'en']],
  ['es-es', ['es', 'es-ES', 'es-419']],
  ['fr-fr', ['fr-CA', 'fr-CH', 'fr-FR', 'fr']],
  ['id-id', ['id', 'id-ID']],
  ['ja-jp', ['ja', 'ja-JP']],
  ['ko-kr', ['ko', 'ko-KR']],
  ['pt-pt', ['pt-BR', 'pt-PT', 'pt']],
  ['ru-ru', ['ru', 'ru-RU']],
  ['th-th', ['th', 'th-TH']],
  ['vi-vn', ['vi', 'vi-VN']]
])

const fixLocalMap = new Map([
  ['en', 'en-us'],
  ['fr', 'fr-fr'],
  ['de', 'de-de'],
  ['es', 'es-es'],
  ['pt', 'pt-pt'],
  ['ru', 'ru-ru'],
  ['ja', 'ja-jp'],
  ['ko', 'ko-kr'],
  ['th', 'th-th'],
  ['vi', 'vi-vn'],
  ['id', 'id-id'],
  ['zh-cn', 'zh-cn'],
  ['zh-tw', 'zh-tw'],
  ['tr', 'tr-tr'],
  ['it', 'it-it']
])

const detectLocale = (value) => {
  const locale = value || (app ? app.getLocale() : 'zh-CN')
  let result = 'zh-cn'
  for (const [key, list] of localeMap) {
    if (locale === key || list.includes(locale)) {
      result = key
      break
    }
  }
  return result
}

const getGameDataPath = (game) => {
  return game ? path.join(userDataPath, game) : userDataPath
}

function existsFile(name, game = null) {
  return fs.existsSync(path.join(getGameDataPath(game), name))
}

const saveJSON = async (name, data, game = null) => {
  try {
    await fs.outputJSON(path.join(getGameDataPath(game), name), data, {
      spaces: 2
    })
  } catch (e) {
    sendMsg(e, 'ERROR')
    await sleep(3)
  }
}

const readJSON = async (dataPathOrName, maybeName = null) => {
  let data = null
  const filePath = maybeName
    ? path.join(dataPathOrName, maybeName)
    : path.join(userDataPath, dataPathOrName)
  try {
    data = await fs.readJSON(filePath)
  } catch (e) {}
  return data
}

const hash = (data, type = 'sha256') => {
  const hmac = crypto.createHmac(type, 'hk4e')
  hmac.update(data)
  return hmac.digest('hex')
}

const md5 = (data) => {
  return crypto.createHash('md5').update(data).digest('hex')
}

const scryptKey = crypto.scryptSync(userPath, 'hk4e', 24)
const cipherAes = (data) => {
  const algorithm = 'aes-192-cbc'
  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv(algorithm, scryptKey, iv)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

const decipherAes = (encrypted) => {
  const algorithm = 'aes-192-cbc'
  const iv = Buffer.alloc(16, 0)
  const decipher = crypto.createDecipheriv(algorithm, scryptKey, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

const localIp = () => {
  const interfaces = os.networkInterfaces()
  for (const devName in interfaces) {
    const iface = interfaces[devName]
    if (!iface) continue
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address
      }
    }
  }
  return '127.0.0.1'
}

const normalizeCacheText = (rawText = '') => {
  return String(rawText)
    .replace(/[\x00-\x1f\x7f-\uffff]+/g, '\n')
    .replace(/(?:1|0)\/0\/(?=https?:\/\/)/g, '\n')
}

async function getCacheText(gamePath) {
  const results = await glob(path.join(gamePath, '/webCaches{/,/*/}Cache/Cache_Data/data_2'), {
    stat: true,
    withFileTypes: true,
    nodir: true,
    windowsPathsNoEscape: true
  })
  if (!results || !results.length) {
    return ['', '']
  }
  const timeSortedFiles = results
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map(p => p.fullpath())
  const cacheText = await fs.readFile(timeSortedFiles[0], 'utf8')
  return [normalizeCacheText(cacheText), timeSortedFiles[0]]
}

const mapToObject = (map) => {
  const newObject = Object.fromEntries(map)
  for (const key of Object.keys(newObject)) {
    if (newObject[key] instanceof Map) {
      newObject[key] = mapToObject(newObject[key])
    }
  }
  return newObject
}

module.exports = {
  readdir,
  sleep,
  request,
  hash,
  md5,
  cipherAes,
  decipherAes,
  saveLog,
  authkeyMask,
  sendMsg,
  existsFile,
  readJSON,
  saveJSON,
  getGameDataPath,
  initWindow,
  getWin,
  localIp,
  userPath,
  detectLocale,
  langMap,
  localeMap,
  fixLocalMap,
  normalizeCacheText,
  getCacheText,
  appRoot,
  userDataPath,
  mapToObject,
  convertTimeZone,
  debounce,
  isPlainObject,
  cloneDeep
}
