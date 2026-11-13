const ExcelJS = require('./module/exceljs.min.js')
const { getData, getGachaType } = require('./getData')
const electron = require('electron')
const { app, ipcMain, dialog } = (typeof electron === 'object' && electron) ? electron : {}
const fs = require('fs-extra')
const path = require('path')
const config = require('./config')
const i18n = require('./i18n')
const { getGameAdapter } = require('../games/registry')
const { cloneDeep } = require('./utils')

function pad(num) {
  return `${num}`.padStart(2, '0')
}

function getTimeString() {
  const d = new Date()
  const YYYY = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const DD = pad(d.getDate())
  const HH = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`
}

const addRawSheet = (workbook, data) => {
  const sheet = workbook.addWorksheet('rawData', { views: [{ state: 'frozen', ySplit: 1 }] })
  const excelKeys = ['gacha_id', 'gacha_type', 'id', 'item_id', 'item_type', 'lang', 'name', 'rank_type', 'time', 'uid']
  sheet.columns = excelKeys.map((key) => ({
    header: key,
    key
  }))
  const rows = []
  for (const [poolKey, value] of data.result) {
    for (const log of value) {
      if (Array.isArray(log)) {
        rows.push([
          '',
          log[4] || poolKey,
          log[5] || '',
          '',
          log[2],
          data.lang,
          log[1],
          String(log[3]),
          log[0],
          data.uid
        ])
      } else {
        rows.push([
          log.gacha_id || '',
          log.gacha_type || poolKey,
          log.id || '',
          log.item_id || '',
          log.item_type,
          data.lang,
          log.name,
          String(log.rank_type),
          log.time,
          data.uid
        ])
      }
    }
  }
  sheet.addRows(rows)
}

const styleCellBorderAndFill = (cell, fillArgb = 'ffebebeb') => {
  cell.border = {
    top: { style: 'thin', color: { argb: 'ffc4c2bf' } },
    left: { style: 'thin', color: { argb: 'ffc4c2bf' } },
    bottom: { style: 'thin', color: { argb: 'ffc4c2bf' } },
    right: { style: 'thin', color: { argb: 'ffc4c2bf' } }
  }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: fillArgb }
  }
}

const createWorkbookBuffer = async (data, gameId = config.currentGame, i18nBundle = null) => {
  if (!data || !data.result || !data.result.size) {
    throw new Error('数据为空')
  }
  const activeI18n = i18nBundle || i18n.forGame(gameId, config.lang)
  const { header, customFont, wish2 } = activeI18n.excel
  const zzzLabels = activeI18n.ui.data
  const typeMap = getGachaType(data.lang, gameId)
  const workbook = new ExcelJS.Workbook()
  const isZzz = gameId === 'zzz'
  const usedSheetNames = new Set()

  for (const [key, value] of data.result) {
    const rawName = (typeMap && typeMap.get(key)) || (data.typeMap && data.typeMap.get(key)) || `Pool_${key}`
    let sheetName = String(rawName).replace(/[*?:\/\\\[\]]/g, ' ').trim().slice(0, 31) || `Pool_${key}`
    if (usedSheetNames.has(sheetName)) {
      sheetName = `${sheetName.slice(0, 27)}_${key}`.slice(0, 31)
    }
    usedSheetNames.add(sheetName)

    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
    let width = [24, 14, 8, 8, 8, 8, 8]
    if (!data.lang || !data.lang.includes('zh-')) {
      width = [24, 32, 16, 12, 12, 12, 8]
    }
    const excelKeys = ['time', 'name', 'type', 'rank', 'total', 'pity', 'remark']
    sheet.columns = excelKeys.map((colKey, index) => ({
      header: header[colKey],
      key: colKey,
      width: width[index]
    }))

    const logs = cloneDeep(value)
    let total = 0
    let pity = 0
    const rows = []
    const rowRanks = []

    for (const log of logs) {
      total += 1
      pity += 1

      if (Array.isArray(log)) {
        const rankNum = parseInt(log[3], 10)
        const gachaType = log[4]
        const row = [log[0], log[1], log[2], rankNum, total, pity]
        if (gameId === 'genshin' && key === '301' && gachaType === '400') {
          row.push(wish2)
        }
        rows.push(row)
        rowRanks.push(rankNum)
        if (rankNum === 5) {
          pity = 0
        }
      } else {
        const rankStr = String(log.rank_type)
        let displayRank = rankStr
        if (isZzz) {
          if (rankStr === '2') displayRank = zzzLabels.star2
          else if (rankStr === '3') displayRank = zzzLabels.star3
          else displayRank = zzzLabels.star4
        }
        rows.push([log.time, log.name, log.item_type, displayRank, total, pity])
        rowRanks.push(rankStr)
        if ((isZzz && rankStr === '4') || (!isZzz && rankStr === '5')) {
          pity = 0
        }
      }
    }

    sheet.addRows(rows)

    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    cols.forEach((v) => {
      const cell = sheet.getCell(`${v}1`)
      styleCellBorderAndFill(cell, 'ffdbd7d3')
      cell.font = {
        name: customFont,
        color: { argb: 'ff757575' },
        bold: true
      }
    })

    const rankColorMap = isZzz
      ? { 2: 'ff8e8e8e', 3: 'ffa256e1', 4: 'ffbd6932' }
      : { 3: 'ff8e8e8e', 4: 'ffa256e1', 5: 'ffbd6932' }
    const lowestRank = isZzz ? '2' : '3'

    rowRanks.forEach((rankVal, i) => {
      cols.forEach((c) => {
        const cell = sheet.getCell(`${c}${i + 2}`)
        styleCellBorderAndFill(cell, 'ffebebeb')
        cell.font = {
          name: customFont,
          color: { argb: rankColorMap[rankVal] || 'ff333333' },
          bold: String(rankVal) !== lowestRank
        }
      })
    })
  }

  addRawSheet(workbook, data)
  return await workbook.xlsx.writeBuffer()
}

const start = async (gameId = config.currentGame) => {
  const { filePrefix, fileType } = i18n.forGame(gameId, config.lang).excel
  const { dataMap, current } = getData(gameId)
  const data = dataMap.get(current)
  const buffer = await createWorkbookBuffer(data, gameId)
  const filePath = dialog.showSaveDialogSync({
    defaultPath: path.join(app.getPath('downloads'), `${filePrefix}_${data.uid}_${getTimeString()}`),
    filters: [
      { name: fileType, extensions: ['xlsx'] }
    ]
  })
  if (filePath) {
    await fs.ensureFile(filePath)
    await fs.writeFile(filePath, buffer)
  }
}

if (ipcMain) {
  ipcMain.handle('SAVE_EXCEL', async () => {
    await start(config.currentGame)
  })
}

module.exports = {
  createWorkbookBuffer,
  addRawSheet,
  start
}
