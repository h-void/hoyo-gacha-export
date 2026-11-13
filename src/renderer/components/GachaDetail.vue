<template>
  <p class="text-gray-500 text-xs mb-2 text-center whitespace-nowrap">
    <span class="mx-2" :title="new Date(detail.date[0]).toLocaleString()">{{new Date(detail.date[0]).toLocaleDateString()}}</span>
    -
    <span class="mx-2" :title="new Date(detail.date[1]).toLocaleString()">{{new Date(detail.date[1]).toLocaleDateString()}}</span>
  </p>
  <p class="text-gray-600 text-xs mb-1">
    <span class="mr-1">{{text.total}}
      <span class="text-blue-600">{{detail.total}}</span> {{text.times}}
    </span>
    <span v-if="showPityCounter">{{text.sum}}<span class="mx-1 text-green-600">{{detail.countMio}}</span>{{(isZzz || isStandardBeyond) ? text.no4star : text.no5star}}</span>
  </p>
  <p v-if="isZzz" class="text-gray-600 text-xs mb-1">
    <span :title="`${text.character}${colon}${detail.count4c}\n${text.weapon}${colon}${detail.count4w}\n${text.bang}${colon}${detail.count4b}`" class="mr-3 whitespace-pre cursor-help text-yellow-500">
      <span class="min-w-10 inline-block">{{text.star4}}{{colon}}{{detail.count4}}</span>
      [{{percent(detail.count4, detail.total)}}]
    </span>
    <br><span :title="`${text.character}${colon}${detail.count3c}\n${text.weapon}${colon}${detail.count3w}\n${text.bang}${colon}${detail.count3b}`" class="mr-3 whitespace-pre cursor-help text-purple-600">
      <span class="min-w-10 inline-block">{{text.star3}}{{colon}}{{detail.count3}}</span>
      [{{percent(detail.count3, detail.total)}}]
    </span>
    <br><span class="text-blue-500 whitespace-pre">
      <span class="min-w-10 inline-block">{{text.star2}}{{colon}}{{detail.count2}}</span>
      [{{percent(detail.count2, detail.total)}}]
    </span>
  </p>
  <p v-else-if="isBeyond" class="text-gray-600 text-xs mb-1">
    <template v-if="!isStandardBeyond || detail.count5">
      <span :title="formatTypeMapTitle(detail.typeMap5)" class="mr-3 whitespace-pre cursor-help text-yellow-500">
        <span class="min-w-10 inline-block">{{text.star5}}{{colon}}{{detail.count5}}</span>
        [{{percent(detail.count5, detail.total)}}]
      </span>
      <br>
    </template>
    <span :title="formatTypeMapTitle(detail.typeMap4)" class="mr-3 whitespace-pre cursor-help text-purple-600">
      <span class="min-w-10 inline-block">{{text.star4}}{{colon}}{{detail.count4}}</span>
      [{{percent(detail.count4, detail.total)}}]
    </span>
    <br><span :title="formatTypeMapTitle(detail.typeMap3)" class="mr-3 whitespace-pre cursor-help text-blue-500">
      <span class="min-w-10 inline-block">{{text.star3}}{{colon}}{{detail.count3}}</span>
      [{{percent(detail.count3, detail.total)}}]
    </span>
    <template v-if="isStandardBeyond || detail.count2">
      <br><span :title="formatTypeMapTitle(detail.typeMap2)" class="mr-3 whitespace-pre cursor-help text-green-600">
        <span class="min-w-10 inline-block">{{text.star2}}{{colon}}{{detail.count2}}</span>
        [{{percent(detail.count2, detail.total)}}]
      </span>
    </template>
  </p>
  <p v-else class="text-gray-600 text-xs mb-1">
    <span :title="`${text.character}${colon}${detail.count5c}\n${text.weapon}${colon}${detail.count5w}`" class="mr-3 whitespace-pre cursor-help text-yellow-500">
      <span class="min-w-10 inline-block">{{text.star5}}{{colon}}{{detail.count5}}</span>
      [{{percent(detail.count5, detail.total)}}]
    </span>
    <br><span :title="`${text.character}${colon}${detail.count4c}\n${text.weapon}${colon}${detail.count4w}`" class="mr-3 whitespace-pre cursor-help text-purple-600">
      <span class="min-w-10 inline-block">{{text.star4}}{{colon}}{{detail.count4}}</span>
      [{{percent(detail.count4, detail.total)}}]
    </span>
    <br><span class="text-blue-500 whitespace-pre">
      <span class="min-w-10 inline-block">{{text.star3}}{{colon}}{{detail.count3}}</span>
      [{{percent(detail.count3, detail.total)}}]
    </span>
  </p>

  <p class="text-gray-600 text-xs mb-1" v-if="detail.ssrPos.length">
    {{ isStandardBeyond ? (text.history4 || text.history) : text.history }}{{colon}}
    <span :title="getSsrTitle(item)" :class="{wish2: game === 'genshin' && item[3] === '400'}" class="cursor-help mr-1" :style="`color:${colorList[index]}`"
      v-for="(item, index) of detail.ssrPos" :key="`${index}-${item[0]}-${item[2]}`"
    >
      {{item[0]}}[{{item[1]}}]
    </span>
  </p>
  <p v-if="detail.ssrPos.length" class="text-gray-600 text-xs">{{ isStandardBeyond ? (text.average4 || text.average) : text.average }}{{colon}}<span class="text-green-600">{{avgSsr(detail.ssrPos)}}</span></p>
</template>

<script setup>
import { computed } from 'vue'
import subPoolLabels from '../../games/beyond/subPoolLabels.json'

const props = defineProps({
  data: Array,
  typeMap: Map,
  i18n: Object,
  lang: {
    type: String,
    default: 'zh-cn'
  },
  game: {
    type: String,
    default: 'genshin'
  }
})

const isZzz = computed(() => props.game === 'zzz')
const isBeyond = computed(() => props.game === 'beyond')
const type = computed(() => props.data[0])
const isStandardBeyond = computed(() => isBeyond.value && String(type.value) === '1000')
const detail = computed(() => props.data[1])
const text = computed(() => props.i18n.ui.data)
const colon = computed(() => props.i18n.symbol.colon)
const showPityCounter = computed(() => !(props.game === 'genshin' && type.value === '100'))

const formatTypeMapTitle = (map) => {
  if (!map || !map.size) return ''
  return Array.from(map.entries())
    .map(([k, v]) => `${k}${colon.value}${v}`)
    .join('\n')
}

const resolveSubPoolLabel = (poolCode) => {
  const normalizedLang = String(props.lang || 'zh-cn').toLowerCase()
  const table = subPoolLabels[normalizedLang] || subPoolLabels['en-us']
  return table?.[poolCode] || poolCode
}

const getSsrTitle = (item) => {
  const time = item[2]
  const poolCode = String(item[3] || '')
  if (props.game === 'genshin' && poolCode === '400') {
    return `${time}\n${props.i18n.excel.wish2}`
  }
  if (props.game === 'beyond' && poolCode && poolCode !== '2000' && poolCode !== '1000') {
    return `${time}\n${resolveSubPoolLabel(poolCode)}`
  }
  return time
}

const avgSsr = (list) => {
  if (!list.length) return 0
  let n = 0
  list.forEach(item => {
    n += item[1]
  })
  return parseInt((n / list.length) * 100, 10) / 100
}

const percent = (num, total) => {
  if (!total) return '0%'
  return `${Math.round(num / total * 10000) / 100}%`
}

const colors = [
  '#5470c6', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#2ab7ca',
  '#005b96', '#ff8b94', '#72a007', '#b60d1b', '#16570d'
]

const colorList = computed(() => {
  let colorsTemp = [...colors]
  const result = []
  const map = new Map()
  props.data[1].ssrPos.forEach(item => {
    if (map.has(item[0])) {
      return result.push(map.get(item[0]))
    }
    const num = Math.abs(hashCode(`${Math.floor(Date.now() / (1000 * 60 * 10))}-${item[0]}`))
    if (!colorsTemp.length) colorsTemp = [...colors]
    const color = colorsTemp.splice(num % colorsTemp.length, 1)[0]
    map.set(item[0], color)
    result.push(color)
  })
  return result
})

function hashCode(str) {
  return Array.from(str)
    .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
}
</script>
