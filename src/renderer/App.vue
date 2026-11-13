<template>
  <div v-if="ui" class="relative">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <el-radio-group
        v-model="state.activeGame"
        :disabled="state.status === 'loading'"
        size="default"
        @change="onGameChange"
      >
        <el-radio-button label="genshin">{{ ui.game.genshin }}</el-radio-button>
        <el-radio-button label="starrail">{{ ui.game.starrail }}</el-radio-button>
        <el-radio-button label="zzz">{{ ui.game.zzz }}</el-radio-button>
      </el-radio-group>

      <div class="flex items-center gap-2">
        <el-select
          v-if="state.status !== 'loading' && dataMap && (dataMap.size > 1 || (dataMap.size >= 1 && state.current === 0))"
          class="!w-40"
          @change="changeCurrent"
          :model-value="uidSelectText"
        >
          <el-option
            v-for="item of dataMap"
            :key="item[0]"
            :label="maskUid(item[0])"
            :value="item[0]"
          />
        </el-select>
        <el-dropdown @command="optionCommand">
          <el-button @click="showSetting(true)" class="focus:outline-none" plain type="info" icon="more">
            {{ ui.button.option }}
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="setting" icon="setting">{{ ui.button.setting }}</el-dropdown-item>
              <el-dropdown-item :disabled="!allowClick() || state.status === 'loading'" command="url" icon="link">{{ ui.button.url }}</el-dropdown-item>
              <el-dropdown-item command="copyUrl" icon="DocumentCopy">{{ ui.button.copyUrl }}</el-dropdown-item>
              <el-dropdown-item command="copyApiUrl" icon="Link">{{ ui.button.copyApiUrl }}</el-dropdown-item>
              <el-dropdown-item :disabled="!allowClick() || state.status === 'loading'" command="proxy" icon="position">{{ ui.button.startProxy }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <el-button
          type="primary"
          :icon="state.status === 'init' ? 'milk-tea' : 'refresh-right'"
          class="focus:outline-none"
          :disabled="!allowClick() || state.status === 'loading'"
          plain
          @click="fetchData()"
          :loading="state.status === 'loading'"
        >
          {{ state.status === 'init' ? ui.button.load : ui.button.update }}
        </el-button>

        <el-dropdown @command="exportCommand">
          <el-button icon="folder-opened" class="focus:outline-none" type="success" plain>
            {{ ui.button.files }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!gachaData" command="excel">{{ ui.button.excel }}</el-dropdown-item>
              <el-dropdown-item :disabled="!hasAnyAccounts" command="uigf-json">{{ ui.button.uigf }}</el-dropdown-item>
              <el-dropdown-item v-if="state.activeGame === 'genshin' && gachaData" command="uigf-v30">{{ ui.setting.uigf30Export }}</el-dropdown-item>
              <el-dropdown-item command="import-json" divided>{{ ui.button.import }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-tooltip v-if="detail && state.status !== 'loading'" :content="ui.hint.newAccount" placement="bottom">
          <el-button @click="newUser()" plain icon="plus" class="focus:outline-none"></el-button>
        </el-tooltip>

        <el-tooltip v-if="state.status === 'updated'" :content="ui.hint.relaunchHint" placement="bottom">
          <el-button @click="relaunch()" type="success" icon="refresh" class="focus:outline-none">
            {{ ui.button.directUpdate }}
          </el-button>
        </el-tooltip>

        <el-tag v-if="state.newVersion" type="success" size="small" class="ml-1">
          v{{ state.newVersion }}
        </el-tag>
      </div>
    </div>

    <p class="text-gray-400 my-2 text-xs">
      {{ hint }}
      <el-button @click="state.showCacheCleanDlg = true" v-if="state.authkeyTimeout" style="margin-left: 8px;" size="small" plain round>
        {{ ui.button.solution }}
      </el-button>
    </p>

    <div v-if="detail" class="gap-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
      <div
        v-for="item of detail"
        :key="`${state.activeGame}-${state.current}-${item[0]}`"
        class="mb-4"
        :class="{ hidden: isHiddenPool(item[0]) }"
      >
        <p class="text-center text-gray-600 my-2 font-medium">{{ typeMap.get(item[0]) || item[0] }}</p>
        <pie-chart :data="item" :i18n="state.i18n" :typeMap="typeMap" :game="state.activeGame"></pie-chart>
        <gacha-detail :i18n="state.i18n" :data="item" :typeMap="typeMap" :game="state.activeGame"></gacha-detail>
      </div>
    </div>

    <Setting
      v-show="state.showSetting"
      :visible="state.showSetting"
      :i18n="state.i18n"
      :gacha-data-info="allDataInfo"
      :active-game="state.activeGame"
      @refreshData="readData(true)"
      @changeLang="getI18nData()"
      @close="showSetting(false)"
    />

    <el-dialog :title="ui.urlDialog.title" v-model="state.showUrlDlg" width="90%" class="max-w-md">
      <p class="mb-4 text-gray-500">{{ ui.urlDialog.hint }}</p>
      <el-input type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" :placeholder="ui.urlDialog.placeholder" v-model="state.urlInput" spellcheck="false"></el-input>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="state.showUrlDlg = false" class="focus:outline-none">{{ ui.common.cancel }}</el-button>
          <el-button type="primary" @click="state.showUrlDlg = false, fetchData(state.urlInput)" class="focus:outline-none">{{ ui.common.ok }}</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog :title="ui.uigf.title" v-model="state.showUigfDlg" width="90%" class="max-w-md">
      <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
        <div class="flex items-center justify-between border-b pb-2">
          <el-checkbox v-model="selectAllUigf">{{ ui.uigf.selectAll }}</el-checkbox>
          <el-checkbox v-model="state.config.readableJSON" @change="saveReadableSetting">{{ ui.setting.uigfReadable }}</el-checkbox>
        </div>
        <div v-for="gId in ['genshin', 'starrail', 'zzz']" :key="gId">
          <template v-if="state.allAccounts[gId] && state.allAccounts[gId].length">
            <p class="text-xs font-medium text-gray-500 mb-1">{{ ui.game[gId] }}</p>
            <div class="space-y-1 pl-2">
              <div v-for="acc in state.allAccounts[gId]" :key="`${gId}:${acc.uid}`" class="flex items-center justify-between text-xs">
                <el-checkbox
                  :model-value="isUigfSelected(gId, acc.uid)"
                  @change="toggleUigfSelection(gId, acc.uid, $event)"
                >
                  {{ maskUid(acc.uid) }} ({{ acc.count }} {{ ui.data.times }})
                </el-checkbox>
              </div>
            </div>
          </template>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="state.showUigfDlg = false" class="focus:outline-none">{{ ui.common.cancel }}</el-button>
          <el-button type="primary" @click="confirmUigfExport" class="focus:outline-none">{{ ui.common.ok }}</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog :title="ui.button.solution" v-model="state.showCacheCleanDlg" width="90%" class="max-w-md cache-clean-dialog">
      <el-button plain icon="folder" type="success" @click="openCacheFolder">{{ ui.button.cacheFolder }}</el-button>
      <p class="my-2 flex flex-col text-teal-800 text-[13px]">
        <span class="my-1" v-for="(txt, idx) of cacheCleanTextList" :key="idx">{{ txt }}</span>
      </p>
      <p class="my-2 text-gray-500 text-xs">{{ ui.extra.findCacheFolder }}</p>
      <template #footer>
        <div class="dialog-footer text-center">
          <el-button type="primary" @click="state.showCacheCleanDlg = false" class="focus:outline-none">{{ ui.common.ok }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
const { ipcRenderer } = require('electron')
import { reactive, computed, onMounted } from 'vue'
import PieChart from './components/PieChart.vue'
import GachaDetail from './components/GachaDetail.vue'
import Setting from './components/Setting.vue'
import gachaDetail from './gachaDetail'
import { version } from '../../package.json'
import genshinGachaType from '../games/genshin/gachaType.json'
import starrailGachaType from '../games/starrail/gachaType.json'
import zzzGachaType from '../games/zzz/gachaType.json'
import { ElMessage } from 'element-plus'

const starrailGachaTypeMap = new Map(starrailGachaType)
const zzzGachaTypeMap = new Map(zzzGachaType)

const HIDDEN_POOL_KEYS = {
  genshin: '100',
  starrail: '2',
  zzz: '1'
}

const state = reactive({
  activeGame: 'genshin',
  status: 'init',
  log: '',
  dataMap: new Map(),
  current: 0,
  allAccounts: { genshin: [], starrail: [], zzz: [] },
  allDataList: [],
  showSetting: false,
  i18n: null,
  showUrlDlg: false,
  showUigfDlg: false,
  uigfSelections: [],
  showCacheCleanDlg: false,
  urlInput: '',
  authkeyTimeout: false,
  newVersion: '',
  config: {}
})

const dataMap = computed(() => {
  const result = new Map()
  for (const [uid, data] of state.dataMap) {
    if (!data.deleted) {
      result.set(uid, data)
    }
  }
  return result
})

const allDataInfo = computed(() => {
  if (state.allDataList && state.allDataList.length) {
    return state.allDataList
  }
  const list = []
  for (const [uid, data] of state.dataMap) {
    list.push({ game: state.activeGame, uid, time: data.time, deleted: Boolean(data.deleted) })
  }
  return list
})

const hasAnyAccounts = computed(() => {
  return ['genshin', 'starrail', 'zzz'].some(gId => (state.allAccounts[gId] || []).length > 0)
})

const ui = computed(() => state.i18n?.ui)

const cacheCleanTextList = computed(() => {
  if (ui.value?.extra?.cacheClean) {
    return ui.value.extra.cacheClean.split('\n')
  }
  return []
})

const gachaData = computed(() => dataMap.value.get(state.current))

const uidSelectText = computed(() => {
  if (state.current === 0 || !dataMap.value.has(state.current)) {
    return state.i18n?.ui?.select?.newAccount || 'New account'
  }
  return state.current
})

const allowClick = () => {
  const data = dataMap.value.get(state.current)
  if (!data) return true
  return Date.now() - data.time >= 1000 * 10
}

const isHiddenPool = (poolKey) => {
  return Boolean(state.config.hideHiddenPool && poolKey === HIDDEN_POOL_KEYS[state.activeGame])
}

const hint = computed(() => {
  const data = dataMap.value.get(state.current)
  if (!state.i18n) {
    return 'Loading...'
  }
  const { hint: hintText } = state.i18n.ui
  const { colon } = state.i18n.symbol
  if (state.status === 'init') {
    return hintText.init
  } else if (state.status === 'loaded' && data) {
    return `${hintText.lastUpdate}${colon}${new Date(data.time).toLocaleString()}`
  } else if (state.status === 'loading') {
    return state.log || 'Loading...'
  } else if (state.status === 'updated') {
    return state.log
  } else if (state.status === 'failed') {
    return `${state.log} - ${hintText.failed}`
  }
  return hintText.init
})

const detail = computed(() => {
  const data = gachaData.value
  if (data) {
    return gachaDetail(data.result, state.activeGame)
  }
  return null
})

const typeMap = computed(() => {
  const lang = state.config.lang || 'zh-cn'
  const result = new Map()
  let list = null
  if (state.activeGame === 'genshin') {
    list = genshinGachaType[lang] || genshinGachaType['en-us'] || genshinGachaType['zh-cn']
  } else if (state.activeGame === 'starrail') {
    list = starrailGachaTypeMap.get(lang) || starrailGachaTypeMap.get('en-us') || starrailGachaTypeMap.get('zh-cn')
  } else {
    list = zzzGachaTypeMap.get(lang) || zzzGachaTypeMap.get('en-us') || zzzGachaTypeMap.get('zh-cn')
  }
  if (list) {
    for (const { key, name } of list) {
      result.set(key, name)
    }
  }
  return result
})

const applyPayload = (payload) => {
  if (!payload) return
  state.activeGame = payload.game || state.activeGame
  state.dataMap = payload.dataMap || new Map()
  state.current = payload.current || 0
  if (payload.allAccounts) {
    state.allAccounts = payload.allAccounts
  }
  if (payload.allDataList) {
    state.allDataList = payload.allDataList
  }
  if (state.current && dataMap.value.get(state.current)) {
    state.status = 'loaded'
  } else {
    state.status = 'init'
  }
}

const fetchData = async (url) => {
  state.log = ''
  state.status = 'loading'
  const data = await ipcRenderer.invoke('FETCH_DATA', url)
  if (data) {
    applyPayload(data)
    await updateConfig()
  } else {
    state.status = 'failed'
  }
}

const readData = async (force = false) => {
  const data = await ipcRenderer.invoke(force ? 'FORCE_READ_DATA' : 'READ_DATA')
  if (data) {
    applyPayload(data)
  }
}

const onGameChange = async (gameId) => {
  state.authkeyTimeout = false
  state.log = ''
  const payload = await ipcRenderer.invoke('SWITCH_GAME', gameId)
  applyPayload(payload)
  await updateConfig()
  await getI18nData()
}

const getI18nData = async () => {
  const data = await ipcRenderer.invoke('I18N_DATA')
  if (data) {
    state.i18n = data
    setTitle()
  }
}

const saveExcel = async () => {
  await ipcRenderer.invoke('SAVE_EXCEL')
}

const isUigfSelected = (game, uid) => {
  return state.uigfSelections.some(item => item.game === game && item.uid === uid)
}

const toggleUigfSelection = (game, uid, checked) => {
  const keyExists = isUigfSelected(game, uid)
  if (checked && !keyExists) {
    state.uigfSelections.push({ game, uid })
  } else if (!checked && keyExists) {
    state.uigfSelections = state.uigfSelections.filter(item => !(item.game === game && item.uid === uid))
  }
}

const allAvailableUigfAccounts = computed(() => {
  const out = []
  for (const gId of ['genshin', 'starrail', 'zzz']) {
    for (const acc of state.allAccounts[gId] || []) {
      out.push({ game: gId, uid: acc.uid })
    }
  }
  return out
})

const selectAllUigf = computed({
  get() {
    const total = allAvailableUigfAccounts.value.length
    return total > 0 && state.uigfSelections.length === total
  },
  set(val) {
    state.uigfSelections = val ? allAvailableUigfAccounts.value.map(item => ({ ...item })) : []
  }
})

const saveReadableSetting = async () => {
  await ipcRenderer.invoke('SAVE_CONFIG', ['readableJSON', Boolean(state.config.readableJSON)])
}

const openUigfDialog = () => {
  state.uigfSelections = []
  if (state.current && dataMap.value.has(state.current)) {
    state.uigfSelections.push({ game: state.activeGame, uid: String(state.current) })
  } else {
    state.uigfSelections = allAvailableUigfAccounts.value.map(item => ({ ...item }))
  }
  state.showUigfDlg = true
}

const confirmUigfExport = async () => {
  if (!state.uigfSelections.length) {
    ElMessage.warning(ui.value.uigf.emptySelection)
    return
  }
  state.showUigfDlg = false
  try {
    await ipcRenderer.invoke('EXPORT_UIGF_JSON', state.uigfSelections.map(item => ({ ...item })), '4.1')
    ElMessage.success(ui.value.uigf.exportSuccess)
  } catch (e) {
    ElMessage.error(e.message || String(e))
  }
}

const exportGenshinV30 = async () => {
  try {
    await ipcRenderer.invoke('EXPORT_UIGF_JSON', null, '3.0')
    ElMessage.success(ui.value.uigf.exportSuccess)
  } catch (e) {
    ElMessage.error(e.message || String(e))
  }
}

const importData = async () => {
  state.status = 'loading'
  try {
    const data = await ipcRenderer.invoke('IMPORT_UIGF_JSON')
    if (data === 'canceled') {
      state.status = gachaData.value ? 'loaded' : 'init'
      return
    }
    if (data) {
      applyPayload(data)
      await updateConfig()
      await getI18nData()
      ElMessage.success(ui.value.uigf.importSuccess)
    } else {
      state.status = 'failed'
    }
  } catch (e) {
    state.status = 'failed'
    ElMessage.error(e.message || String(e))
  }
}

const exportCommand = (type) => {
  if (type === 'excel') {
    saveExcel()
  } else if (type === 'uigf-json') {
    openUigfDialog()
  } else if (type === 'uigf-v30') {
    exportGenshinV30()
  } else if (type === 'import-json') {
    importData()
  }
}

const openCacheFolder = async () => {
  await ipcRenderer.invoke('OPEN_CACHE_FOLDER')
}

const changeCurrent = async (uid) => {
  if (uid === 0) {
    state.status = 'init'
  } else {
    state.status = 'loaded'
  }
  state.current = uid
  await ipcRenderer.invoke('CHANGE_UID', uid, state.activeGame)
}

const newUser = async () => {
  await changeCurrent(0)
}

const relaunch = async () => {
  await ipcRenderer.invoke('RELAUNCH')
}

const maskUid = (uid) => {
  return uid
}

const showSetting = (show) => {
  if (show) {
    state.showSetting = true
  } else {
    state.showSetting = false
    updateConfig()
  }
}

const optionCommand = (type) => {
  if (type === 'setting') {
    showSetting(true)
  } else if (type === 'url') {
    state.urlInput = ''
    state.showUrlDlg = true
  } else if (type === 'proxy') {
    fetchData('proxy')
  } else if (type === 'copyUrl') {
    copyUrl()
  } else if (type === 'copyApiUrl') {
    copyApiUrl()
  }
}

const copyUrl = async () => {
  const successed = await ipcRenderer.invoke('COPY_URL')
  if (successed) {
    ElMessage.success(ui.value.extra.urlCopied)
  } else {
    ElMessage.error(state.i18n.log.url.notFound)
  }
}

const copyApiUrl = async () => {
  const successed = await ipcRenderer.invoke('COPY_API_URL')
  if (successed) {
    ElMessage.success(ui.value.extra.apiUrlCopied)
  } else {
    ElMessage.error(state.i18n.log.url.notFound)
  }
}

const setTitle = () => {
  if (!state.i18n) return
  const gameTitle = state.i18n.ui.game[state.activeGame] || ''
  document.title = `${state.i18n.ui.win.appTitle} (${gameTitle}) - v${version}`
}

const updateConfig = async () => {
  state.config = await ipcRenderer.invoke('GET_CONFIG')
  if (state.config?.currentGame) {
    state.activeGame = state.config.currentGame
  }
}

onMounted(async () => {
  await updateConfig()
  await readData()
  await getI18nData()

  ipcRenderer.on('LOAD_DATA_STATUS', (event, message) => {
    state.log = message
  })

  ipcRenderer.on('ERROR', (event, err) => {
    console.error(err)
  })

  ipcRenderer.on('UPDATE_HINT', (event, message) => {
    state.log = message
    state.status = 'updated'
  })

  ipcRenderer.on('NEW_VERSION', (event, ver) => {
    state.newVersion = ver
  })

  ipcRenderer.on('AUTHKEY_TIMEOUT', (event, message) => {
    state.authkeyTimeout = message
  })
})
</script>
