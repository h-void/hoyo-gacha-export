<template>
  <div v-if="i18n" class="bg-white py-4 px-6 w-screen h-screen fixed inset-0 overflow-y-auto z-50">
    <div class="flex content-center items-center mb-4 justify-between">
      <h3 class="text-lg font-medium">{{text.title}} — {{gameLabel}}</h3>
      <el-button icon="close" @click="closeSetting" plain circle type="default" class="w-8 h-8 shadow-md focus:shadow-none focus:outline-none fixed top-4 right-6"></el-button>
    </div>
    <el-form :model="settingForm" label-width="135px">
      <el-form-item :label="text.language">
        <el-select @change="saveLang" v-model="settingForm.lang" class="!w-44">
          <el-option v-for="item of data.langMap" :key="item[0]" :label="item[1]" :value="item[0]"></el-option>
        </el-select>
        <p class="text-gray-400 text-xs m-1.5">{{text.languageHint}}</p>
      </el-form-item>

      <el-form-item :label="text.logType">
        <el-radio-group @change="saveSetting" v-model.number="settingForm.logType">
          <el-radio-button :label="0">{{text.auto}}</el-radio-button>
          <el-radio-button :label="1">{{text.cnServer}}</el-radio-button>
          <el-radio-button :label="2">{{text.seaServer}}</el-radio-button>
          <el-radio-button v-if="activeGame === 'genshin' && settingForm.lang === 'zh-cn'" :label="3">{{ui.button.cloud}}</el-radio-button>
        </el-radio-group>
        <p class="text-gray-400 text-xs m-1.5">{{text.logTypeHint}}</p>
      </el-form-item>

      <el-form-item :label="common.data">
        <el-button type="primary" plain @click="state.showDataDialog = true">{{common.dataManage}}</el-button>
        <p class="text-gray-400 text-xs m-1.5">{{text.dataManagerHint}}</p>
      </el-form-item>

      <el-form-item :label="text.uigfGenshinTitle || 'UIGF'">
        <div class="flex flex-wrap items-center gap-3">
          <el-checkbox v-model="settingForm.readableJSON" @change="saveSetting">{{ text.uigfReadable }}</el-checkbox>
          <el-button
            v-if="activeGame === 'genshin'"
            :loading="data.loadingUigf"
            size="small"
            plain
            type="success"
            @click="exportGenshinV30"
          >{{ text.uigf30Export }}</el-button>
        </div>
        <p class="text-gray-400 text-xs m-1.5 leading-normal">
          {{ text.UIGFHint || '' }}
          <a class="cursor-pointer text-blue-400" @click="openLink(`https://uigf.org/${settingForm.lang.startsWith('zh-') ? 'zh/' : 'en/'}`)">
            https://uigf.org/
          </a>
        </p>
      </el-form-item>

      <el-form-item :label="text.autoUpdate">
        <el-switch @change="saveSetting" v-model="settingForm.autoUpdate"></el-switch>
      </el-form-item>

      <el-form-item :label="text.hideHiddenPool">
        <el-switch @change="saveSetting" v-model="settingForm.hideHiddenPool"></el-switch>
      </el-form-item>

      <el-form-item :label="text.fetchFullHistory">
        <el-switch @change="saveSetting" v-model="settingForm.fetchFullHistory"></el-switch>
        <p class="text-gray-400 text-xs m-1.5">{{text.fetchFullHistoryHint}}</p>
      </el-form-item>

      <el-form-item :label="text.proxyMode">
        <el-switch @change="saveSetting" v-model="settingForm.proxyMode"></el-switch>
        <p class="text-gray-400 text-xs m-1.5">{{text.proxyModeHint}}</p>
        <el-button class="focus:outline-none" @click="disableProxy">{{text.closeProxy}}</el-button>
        <p class="text-gray-400 text-xs m-1.5">{{text.closeProxyHint}}</p>
      </el-form-item>
    </el-form>

    <div class="border-t pt-4 mt-2 pb-6">
      <h3 class="text-base font-medium mb-2">{{about.title}}</h3>
      <p class="text-gray-700 text-xs font-medium">HoYo Gacha Export (hoyo-gacha-export) v{{version}}</p>
      <p class="text-gray-500 text-xs mt-1">{{text.idVersion}} — HSR v{{starrailIdJson.version}} / ZZZ v{{zzzIdJson.version}}</p>
      <p class="text-gray-600 text-xs mt-1">{{about.license}}</p>
      <p class="text-gray-600 text-xs mt-1">
        GitHub: <a @click="openLink('https://github.com/h-void/hoyo-gacha-export')" class="cursor-pointer text-blue-500 hover:underline">https://github.com/h-void/hoyo-gacha-export</a>
        · UIGF: <a @click="openLink('https://uigf.org/')" class="cursor-pointer text-blue-500 hover:underline">https://uigf.org/</a>
      </p>

      <div class="mt-3 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 space-y-1">
        <p class="font-medium text-gray-700">{{about.creditsTitle}}</p>
        <p>{{about.creditsIntro}}</p>
        <ul class="list-disc pl-5 space-y-0.5">
          <li>
            <a @click="openLink('https://github.com/biuuu/genshin-wish-export')" class="cursor-pointer text-blue-500 hover:underline">biuuu/genshin-wish-export</a>
            <span> (MIT, Copyright © 2021 biuuu)</span>
          </li>
          <li>
            <a @click="openLink('https://github.com/biuuu/star-rail-warp-export')" class="cursor-pointer text-blue-500 hover:underline">biuuu/star-rail-warp-export</a>
            <span> (MIT, Copyright © 2023 biuuu)</span>
          </li>
          <li>
            <a @click="openLink('https://github.com/earthjasonlin/zzz-signal-search-export')" class="cursor-pointer text-blue-500 hover:underline">earthjasonlin/zzz-signal-search-export</a>
            <span> (MIT, Copyright © 2024 earthjasonlin)</span>
          </li>
        </ul>
      </div>
    </div>

    <el-dialog v-model="state.showDataDialog" :title="common.dataManage" width="90%">
      <el-table :data="gachaDataInfo" border stripe max-height="360">
        <el-table-column :label="common.game" width="120">
          <template #default="scope">
            <el-tag size="small" :type="gameTagType(scope.row.game)">{{ ui.game[scope.row.game] || scope.row.game }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column property="uid" label="UID" width="130" />
        <el-table-column property="time" :label="common.updateTime">
          <template #default="scope">
            {{ new Date(scope.row.time).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column property="deleted" :label="common.status" width="100">
          <template #default="scope">
            <el-tag type="info" size="small" v-if="scope.row.deleted">{{common.deleted}}</el-tag>
            <el-tag type="success" size="small" v-else>{{common.normal}}</el-tag>
          </template>
        </el-table-column>
        <el-table-column property="deleted" :label="common.action" width="100">
          <template #default="scope">
            <el-tooltip :content="scope.row.deleted ? common.restore : common.delete" placement="top">
              <el-button :loading="state.dataActionLoading" size="small" icon="refresh" plain type="success" @click="deleteData(scope.row.uid, false, scope.row.game)" v-if="scope.row.deleted"></el-button>
              <el-button :loading="state.dataActionLoading" size="small" icon="delete" plain type="danger" @click="deleteData(scope.row.uid, true, scope.row.game)" v-else></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
const { ipcRenderer, shell } = require('electron')
import starrailIdJson from '../../games/starrail/idJson.json'
import zzzIdJson from '../../games/zzz/idJson.json'
import { version } from '../../../package.json'
import { reactive, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits(['close', 'changeLang', 'refreshData'])

const props = defineProps({
  i18n: Object,
  gachaDataInfo: Array,
  activeGame: {
    type: String,
    default: 'genshin'
  },
  visible: {
    type: Boolean,
    default: false
  }
})

const data = reactive({
  langMap: new Map(),
  loadingUigf: false
})

const settingForm = reactive({
  lang: 'zh-cn',
  logType: 0,
  proxyMode: false,
  autoUpdate: true,
  fetchFullHistory: false,
  hideHiddenPool: false,
  readableJSON: false
})

const state = reactive({
  showDataDialog: false,
  dataActionLoading: false
})

const ui = computed(() => props.i18n.ui)
const common = computed(() => props.i18n.ui.common)
const text = computed(() => props.i18n.ui.setting)
const about = computed(() => props.i18n.ui.about)
const gameLabel = computed(() => props.i18n.ui.game[props.activeGame] || props.activeGame)

const loadConfig = async () => {
  const config = await ipcRenderer.invoke('GET_CONFIG')
  if (config) {
    Object.assign(settingForm, config)
  }
}

watch(() => [props.activeGame, props.visible], () => {
  loadConfig()
})

const saveSetting = async () => {
  const keys = ['lang', 'logType', 'proxyMode', 'autoUpdate', 'fetchFullHistory', 'hideHiddenPool', 'readableJSON']
  for (const key of keys) {
    await ipcRenderer.invoke('SAVE_CONFIG', [key, settingForm[key]])
  }
}

const saveLang = async () => {
  await saveSetting()
  emit('changeLang')
}

const closeSetting = () => emit('close')

const disableProxy = async () => {
  await ipcRenderer.invoke('DISABLE_PROXY')
}

const openLink = (link) => shell.openExternal(link)

const gameTagType = (game) => {
  if (game === 'starrail') return 'warning'
  if (game === 'zzz') return 'success'
  return ''
}

const exportGenshinV30 = async () => {
  data.loadingUigf = true
  try {
    await ipcRenderer.invoke('EXPORT_UIGF_JSON', null, '3.0')
    ElMessage.success(props.i18n.ui.uigf.exportSuccess)
  } catch (e) {
    ElMessage.error(e.message || String(e))
  } finally {
    data.loadingUigf = false
  }
}

const deleteData = async (uid, action, gameId) => {
  state.dataActionLoading = true
  await ipcRenderer.invoke('DELETE_DATA', uid, action, gameId)
  state.dataActionLoading = false
  emit('refreshData')
}

onMounted(async () => {
  data.langMap = await ipcRenderer.invoke('LANG_MAP')
  await loadConfig()
})
</script>

<style>
.el-form-item__label {
  line-height: normal !important;
  position: relative;
  top: 6px;
}
.el-form-item__content {
  flex-direction: column;
  align-items: start !important;
}
.el-form-item--default {
  margin-bottom: 14px !important;
}
</style>
