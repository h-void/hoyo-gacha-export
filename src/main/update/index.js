const electron = require('electron')
const { app } = (typeof electron === 'object' && electron) ? electron : {}
const fetch = require('electron-fetch').default
const semver = require('semver')
const { version } = require('../../../package.json')
const { sendMsg } = require('../utils')
const config = require('../config')

const updateInfo = {
  status: 'init'
}

const isDev = app ? !app.isPackaged : true

const checkUpdate = async () => {
  if (isDev || !config.autoUpdate) return
  try {
    const res = await fetch('https://api.github.com/repos/h-void/hoyo-gacha-export/releases/latest', {
      timeout: 10 * 1000,
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `hoyo-gacha-export/${version}`
      }
    })
    if (!res.ok) return
    const data = await res.json()
    const latestTag = String(data?.tag_name || '').replace(/^v/i, '')
    if (semver.valid(latestTag) && semver.gt(latestTag, version)) {
      updateInfo.status = 'available'
      sendMsg(latestTag, 'NEW_VERSION')
    }
  } catch (e) {
    updateInfo.status = 'failed'
  }
}

const getUpdateInfo = () => updateInfo

if (app) {
  setTimeout(checkUpdate, 2000)
}

exports.getUpdateInfo = getUpdateInfo
exports.checkUpdate = checkUpdate
