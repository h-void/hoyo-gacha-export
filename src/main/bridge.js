const electron = require('electron')
const { clipboard, ipcMain } = (typeof electron === 'object' && electron) ? electron : {}
const { getUrl, getApiUrl, deleteData } = require('./getData')
const config = require('./config')

if (ipcMain) {
  ipcMain.handle('COPY_URL', async () => {
    const url = await getUrl(config.currentGame)
    if (url) {
      clipboard.writeText(url)
      return true
    }
    return false
  })

  ipcMain.handle('COPY_API_URL', async () => {
    const apiUrl = await getApiUrl(config.currentGame)
    if (apiUrl) {
      clipboard.writeText(apiUrl)
      return true
    }
    return false
  })

  ipcMain.handle('DELETE_DATA', async (event, uid, action, gameId) => {
    await deleteData(uid, action, gameId || config.currentGame)
  })
}
