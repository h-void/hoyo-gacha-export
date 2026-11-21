<template>
  <div v-if="ui" class="relative">
    <!-- Level 1: Game Selector -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="flex flex-wrap items-center gap-2">
        <el-radio-group
          :model-value="isPendingGame ? '' : activeParentGame.id"
          :disabled="state.status === 'loading'"
          size="default"
          @change="onParentGameChange"
        >
          <el-radio-button v-for="gameItem in ACTIVE_PARENT_GAMES" :key="gameItem.id" :value="gameItem.id">
            {{ ui.game[gameItem.id] }}
          </el-radio-button>
        </el-radio-group>

        <el-dropdown :disabled="state.status === 'loading'" @command="onParentGameChange">
          <el-button
            :type="isPendingGame ? 'primary' : 'default'"
            :plain="!isPendingGame"
            class="focus:outline-none"
          >
            {{ isPendingGame ? ui.game[activeParentGame.id] : ui.gameGroup.more }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in PENDING_PARENT_GAMES"
                :key="item.id"
                :command="item.id"
                :class="{ 'font-semibold text-blue-600': activeParentGame.id === item.id }"
              >
                <div class="flex items-center justify-between gap-3 w-full">
                  <span>{{ ui.game[item.id] }}</span>
                  <el-tag size="small" :type="item.tagType" effect="plain">
                    {{ ui.gameStatus[item.statusKey] }}
                  </el-tag>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <div class="flex items-center gap-2">
        <el-select
          v-if="state.status !== 'loading' && dataMap && (dataMap.size > 1 || (dataMap.size >= 1 && state.current === 0))"
          class="w-40!"
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
              <el-dropdown-item :disabled="isPendingGame || !allowClick() || state.status === 'loading'" command="url" icon="link">{{ ui.button.url }}</el-dropdown-item>
              <el-dropdown-item :disabled="isPendingGame" command="copyUrl" icon="DocumentCopy">{{ ui.button.copyUrl }}</el-dropdown-item>
              <el-dropdown-item :disabled="isPendingGame" command="copyApiUrl" icon="Link">{{ ui.button.copyApiUrl }}</el-dropdown-item>
              <el-dropdown-item :disabled="isPendingGame || !allowClick() || state.status === 'loading'" command="proxy" icon="position">{{ ui.button.startProxy }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Level 2: Record / Gacha Type Selector under Active Game -->
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500">{{ ui.gameType.label }}{{ state.i18n.symbol.colon }}</span>
        <el-radio-group
          :model-value="state.activeGame"
          :disabled="state.status === 'loading'"
          size="small"
          @change="onGameChange"
        >
          <el-radio-button
            v-for="mode in activeParentGame.modes"
            :key="mode.id"
            :value="mode.id"
          >
            {{ ui.gameType[mode.modeKey] || mode.modeKey }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <el-button
          type="primary"
          size="small"
          :icon="state.status === 'init' ? 'milk-tea' : 'refresh-right'"
          class="focus:outline-none"
          :disabled="isPendingGame || !allowClick() || state.status === 'loading'"
          plain
          @click="fetchData()"
          :loading="state.status === 'loading'"
        >
          {{ state.status === 'init' ? ui.button.load : ui.button.update }}
        </el-button>

        <el-dropdown @command="exportCommand">
          <el-button size="small" icon="folder-opened" class="focus:outline-none" type="success" plain>
            {{ ui.button.files }}
            <el-icon class="el-icon--right"><arrow-down /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item :disabled="!gachaData" command="excel">{{ ui.button.excel }}</el-dropdown-item>
              <el-dropdown-item :disabled="!hasAnyUigfAccounts" command="uigf-json">{{ ui.button.uigf }}</el-dropdown-item>
              <el-dropdown-item :disabled="!gachaData" command="export-game-json">{{ ui.button.exportGameJson }}</el-dropdown-item>
              <el-dropdown-item v-if="state.activeGame === 'genshin' && gachaData" command="uigf-v30">{{ ui.setting.uigf30Export }}</el-dropdown-item>
              <el-dropdown-item command="import-json" divided>{{ ui.button.import }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-tooltip v-if="!isPendingGame && detail && state.status !== 'loading'" :content="ui.hint.newAccount" placement="bottom">
          <el-button size="small" @click="newUser()" plain icon="plus" class="focus:outline-none"></el-button>
        </el-tooltip>

        <el-tooltip v-if="state.status === 'updated'" :content="ui.hint.relaunchHint" placement="bottom">
          <el-button size="small" @click="relaunch()" type="success" icon="refresh" class="focus:outline-none">
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

    <!-- Optional Level 3: Banner Type Filter when multiple banner pools exist -->
    <div v-if="visibleDetailEntries.length > 1" class="flex flex-wrap items-center gap-1.5 mb-3">
      <span class="text-xs text-gray-400">{{ ui.gameType.poolFilter }}{{ state.i18n.symbol.colon }}</span>
      <el-check-tag
        :checked="state.selectedPool === 'all'"
        size="small"
        @change="state.selectedPool = 'all'"
      >
        {{ ui.gameType.allPools }}
      </el-check-tag>
      <el-check-tag
        v-for="entry in visibleDetailEntries"
        :key="`filter-${entry[0]}`"
        :checked="state.selectedPool === entry[0]"
        size="small"
        @change="state.selectedPool = state.selectedPool === entry[0] ? 'all' : entry[0]"
      >
        {{ typeMap.get(entry[0]) || entry[0] }} ({{ entry[1].total }})
      </el-check-tag>
    </div>

    <div
      v-if="isPendingGame && !detail && ui.pending"
      class="mt-4 p-5 rounded-lg border border-gray-200 bg-gray-50 max-w-2xl"
    >
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <h3 class="text-base font-medium text-gray-800">{{ ui.pending.title }}</h3>
        <el-tag size="small" type="warning" effect="plain">{{ ui.pending.badge }}</el-tag>
      </div>
      <p class="text-xs text-gray-600 leading-relaxed mb-2">{{ ui.pending.description }}</p>
      <p class="text-xs text-gray-500 leading-relaxed mb-4">{{ ui.pending.capabilities }}</p>
      <el-button type="primary" plain icon="folder-opened" @click="importData">
        {{ ui.button.import }}
      </el-button>
    </div>

    <div v-if="displayedDetailEntries.length" class="gap-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4">
      <div
        v-for="item of displayedDetailEntries"
        :key="`${state.activeGame}-${state.current}-${item[0]}`"
        class="mb-4"
      >
        <p class="text-center text-gray-600 my-2 font-medium">{{ typeMap.get(item[0]) || item[0] }}</p>
        <pie-chart :data="item" :i18n="state.i18n" :typeMap="typeMap" :game="state.activeGame"></pie-chart>
        <gacha-detail :i18n="state.i18n" :data="item" :typeMap="typeMap" :lang="state.config.lang" :game="state.activeGame"></gacha-detail>
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
        <div v-for="gId in UIGF_GAME_LIST" :key="gId">
          <template v-if="state.allAccounts[gId] && state.allAccounts[gId].length">
            <p class="text-xs font-medium text-gray-500 mb-1">{{ formatGameAndMode(gId) }}</p>
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
const { ipcRenderer } = window.require('electron')
import { reactive, computed, onMounted } from 'vue'
import PieChart from './components/PieChart.vue'
import GachaDetail from './components/GachaDetail.vue'
import Setting from './components/Setting.vue'
import gachaDetail from './gachaDetail'
import { version } from '../../package.json'
import gameCatalog from '../games/catalog.json'
import genshinGachaType from '../games/genshin/gachaType.json'
import beyondGachaType from '../games/beyond/gachaType.json'
import starrailGachaType from '../games/starrail/gachaType.json'
import starrailBlindboxGachaType from '../games/starrail_blindbox/gachaType.json'
import zzzGachaType from '../games/zzz/gachaType.json'
import bh3GachaType from '../games/bh3/gachaType.json'
import petitplanetGachaType from '../games/petitplanet/gachaType.json'
import nexusanimaGachaType from '../games/nexusanima/gachaType.json'
import { ElMessage } from 'element-plus'

const starrailGachaTypeMap = new Map(starrailGachaType)
const zzzGachaTypeMap = new Map(zzzGachaType)

const ACTIVE_PARENT_GAMES = gameCatalog.filter(g => g.group === 'active')
const PENDING_PARENT_GAMES = gameCatalog.filter(g => g.group === 'pending')
const PENDING_GAME_SET = new Set(PENDING_PARENT_GAMES.flatMap(g => g.modes.map(m => m.id)))
const UIGF_GAME_LIST = ['genshin', 'beyond', 'starrail', 'zzz']

const ADAPTER_TO_PARENT = {}
const ADAPTER_TO_MODE_KEY = {}
for (const entry of gameCatalog) {
  for (const mode of entry.modes) {
    ADAPTER_TO_PARENT[mode.id] = entry
    ADAPTER_TO_MODE_KEY[mode.id] = mode.modeKey
  }
}

const HIDDEN_POOL_KEYS = {
  genshin: '100',
  starrail: '2',
  zzz: '1',
  beyond: '1000',
  bh3: 'bh3_dorm'
}

const OBJECT_GACHA_TYPE_TABLES = {
  genshin: genshinGachaType,
  beyond: beyondGachaType,
  starrail_blindbox: starrailBlindboxGachaType,
  bh3: bh3GachaType,
  petitplanet: petitplanetGachaType,
  nexusanima: nexusanimaGachaType
}

const state = reactive({
  activeGame: 'genshin',
  lastModeByParent: {},
  selectedPool: 'all',
  status: 'init',
  log: '',
  dataMap: new Map(),
  current: 0,
  allAccounts: {
    genshin: [],
    beyond: [],
    starrail: [],
    starrail_blindbox: [],
    zzz: [],
    bh3: [],
    petitplanet: [],
    nexusanima: []
  },
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

const activeParentGame = computed(() => ADAPTER_TO_PARENT[state.activeGame] || gameCatalog[0])
const isPendingGame = computed(() => PENDING_GAME_SET.has(state.activeGame))

const formatGameAndMode = (adapterId) => {
  if (!ui.value) return adapterId
  const parent = ADAPTER_TO_PARENT[adapterId]
  const modeKey = ADAPTER_TO_MODE_KEY[adapterId]
  const parentName = ui.value.game[parent?.id || adapterId] || adapterId
  const modeName = modeKey ? ui.value.gameType?.[modeKey] : ''
  return modeName ? `${parentName} · ${modeName}` : parentName
}

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

const hasAnyUigfAccounts = computed(() => {
  return UIGF_GAME_LIST.some(gId => (state.allAccounts[gId] || []).length > 0)
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
  const hiddenKey = HIDDEN_POOL_KEYS[state.activeGame]
  return Boolean(hiddenKey && state.config.hideHiddenPool && poolKey === hiddenKey)
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

const visibleDetailEntries = computed(() => {
  if (!detail.value) return []
  return Array.from(detail.value.entries()).filter(([key]) => !isHiddenPool(key))
})

const displayedDetailEntries = computed(() => {
  if (!visibleDetailEntries.value.length) return []
  if (state.selectedPool === 'all') return visibleDetailEntries.value
  const matched = visibleDetailEntries.value.filter(([key]) => key === state.selectedPool)
  return matched.length ? matched : visibleDetailEntries.value
})

const typeMap = computed(() => {
  const lang = state.config.lang || 'zh-cn'
  const result = new Map()
  // Start with persisted per-account pool names (important for dynamic BH3 / BlindBox pools)
  const storedTypeMap = gachaData.value?.typeMap
  if (storedTypeMap instanceof Map) {
    for (const [k, v] of storedTypeMap.entries()) {
      result.set(k, v)
    }
  } else if (Array.isArray(storedTypeMap)) {
    for (const pair of storedTypeMap) {
      if (Array.isArray(pair) && pair.length >= 2) {
        result.set(pair[0], pair[1])
      }
    }
  }

  let list = null
  if (state.activeGame === 'starrail') {
    list = starrailGachaTypeMap.get(lang) || starrailGachaTypeMap.get('en-us') || starrailGachaTypeMap.get('zh-cn')
  } else if (state.activeGame === 'zzz') {
    list = zzzGachaTypeMap.get(lang) || zzzGachaTypeMap.get('en-us') || zzzGachaTypeMap.get('zh-cn')
  } else {
    const table = OBJECT_GACHA_TYPE_TABLES[state.activeGame]
    if (table) {
      list = table[lang] || table['en-us'] || table['zh-cn']
    }
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
  const parent = ADAPTER_TO_PARENT[state.activeGame]
  if (parent) {
    state.lastModeByParent[parent.id] = state.activeGame
  }
  state.selectedPool = 'all'
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
  if (isPendingGame.value) return
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

const onParentGameChange = async (parentId) => {
  const entry = gameCatalog.find(g => g.id === parentId)
  if (!entry || !entry.modes.length) return
  const targetMode = state.lastModeByParent[parentId] || entry.modes[0].id
  await onGameChange(targetMode)
}

const onGameChange = async (gameId) => {
  if (!gameId) return
  state.authkeyTimeout = false
  state.log = ''
  state.selectedPool = 'all'
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
  for (const gId of UIGF_GAME_LIST) {
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
  if (UIGF_GAME_LIST.includes(state.activeGame) && state.current && dataMap.value.has(state.current)) {
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
    await ipcRenderer.invoke('EXPORT_UIGF_JSON', state.uigfSelections.map(item => ({ ...item })), '4.2')
    ElMessage.success(ui.value.uigf.exportSuccess)
  } catch (e) {
    ElMessage.error(e.message || String(e))
  }
}

const exportGameJson = async () => {
  try {
    await ipcRenderer.invoke('EXPORT_GAME_JSON', state.activeGame, state.current || null)
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
  } else if (type === 'export-game-json') {
    exportGameJson()
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
  state.selectedPool = 'all'
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
    if (isPendingGame.value) return
    state.urlInput = ''
    state.showUrlDlg = true
  } else if (type === 'proxy') {
    if (isPendingGame.value) return
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
  const label = formatGameAndMode(state.activeGame)
  document.title = `${state.i18n.ui.win.appTitle} (${label}) - v${version}`
}

const updateConfig = async () => {
  state.config = await ipcRenderer.invoke('GET_CONFIG')
  if (state.config?.currentGame) {
    state.activeGame = state.config.currentGame
    const parent = ADAPTER_TO_PARENT[state.activeGame]
    if (parent) {
      state.lastModeByParent[parent.id] = state.activeGame
    }
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
