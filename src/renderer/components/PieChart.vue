<template>
  <div class="chart mb-2 relative h-48 lg:h-56 xl:h-64 2xl:h-72">
    <div ref="chart" class="absolute inset-0"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { use, init } from 'echarts/core'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'
import { PieChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'
import throttle from 'lodash-es/throttle'

use([
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  PieChart,
  CanvasRenderer
])

const props = defineProps({
  data: Array,
  typeMap: Map,
  i18n: Object,
  game: {
    type: String,
    default: 'genshin'
  }
})

const chart = ref(null)

const standardColors = ['#fac858', '#ee6666', '#5470c6', '#91cc75', '#73c0de']
const zzzColors = ['#fac858', '#fac858', '#ee6666', '#5470c6', '#5470c6', '#91cc75', '#73c0de']
const beyondColors = ['#fac858', '#a256e1', '#5470c6', '#91cc75']
const genericRankGames = new Set(['bh3', 'starrail_blindbox', 'petitplanet', 'nexusanima'])

const parseData = (detail, poolKey, game) => {
  const text = props.i18n.ui.data
  if (game === 'beyond') {
    const isStandard = String(poolKey) === '1000'
    const keys = [
      [text.star5, 'count5'],
      [text.star4, 'count4'],
      [text.star3, 'count3'],
      [text.star2, 'count2']
    ]
    const result = []
    const color = []
    const lowestName = isStandard ? text.star2 : text.star3
    const hasTop = isStandard ? detail.count4 > 0 : detail.count5 > 0
    const selected = {
      [lowestName]: !hasTop
    }
    keys.forEach((key, index) => {
      if (!detail[key[1]]) return
      result.push({
        value: detail[key[1]],
        name: key[0]
      })
      color.push(beyondColors[index])
    })
    return [result, color, selected]
  }

  if (genericRankGames.has(game)) {
    const keys = [
      [text.star5, 'count5'],
      [text.star4, 'count4'],
      [text.star3, 'count3']
    ]
    const result = []
    const color = []
    const selected = {
      [text.star3]: detail.count5 === 0
    }
    keys.forEach((key, index) => {
      if (!detail[key[1]]) return
      result.push({
        value: detail[key[1]],
        name: key[0]
      })
      color.push(beyondColors[index])
    })
    return [result, color, selected]
  }

  if (game === 'zzz') {
    const keys = [
      [text.bang4, 'count4b'],
      [text.chara4, 'count4c'],
      [text.weapon4, 'count4w'],
      [text.chara3, 'count3c'],
      [text.bang3, 'count3b'],
      [text.weapon3, 'count3w'],
      [text.weapon2, 'count2w']
    ]
    const result = []
    const color = []
    const selected = {
      [text.weapon2]: detail.count4 === 0
    }
    keys.forEach((key, index) => {
      if (!detail[key[1]]) return
      result.push({
        value: detail[key[1]],
        name: key[0]
      })
      color.push(zzzColors[index])
    })
    return [result, color, selected]
  }

  const keys = [
    [text.chara5, 'count5c'],
    [text.weapon5, 'count5w'],
    [text.chara4, 'count4c'],
    [text.weapon4, 'count4w'],
    [text.weapon3, 'count3w']
  ]
  const result = []
  const color = []
  const selected = {
    [text.weapon3]: (game === 'genshin' && poolKey === '100') || detail.count5 === 0
  }
  keys.forEach((key, index) => {
    if (!detail[key[1]]) return
    result.push({
      value: detail[key[1]],
      name: key[0]
    })
    color.push(standardColors[index])
  })
  return [result, color, selected]
}

let pieChart = null
const updateChart = throttle(() => {
  if (!chart.value || !props.data || !props.i18n) return
  if (!pieChart) {
    pieChart = init(chart.value)
  }

  const colon = props.i18n.symbol.colon
  const [seriesData, colors, selected] = parseData(props.data[1], props.data[0], props.game)

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: `{b0}${colon}{c0}`,
      padding: 4,
      textStyle: {
        fontSize: 12
      }
    },
    legend: {
      top: '2%',
      left: 'center',
      selected
    },
    selectedMode: 'single',
    color: colors,
    series: [
      {
        name: props.typeMap.get(props.data[0]) || props.data[0],
        type: 'pie',
        top: 50,
        startAngle: 70,
        radius: ['0%', '90%'],
        labelLine: {
          length: 0,
          length2: 10
        },
        label: {
          overflow: 'break'
        },
        data: seriesData
      }
    ]
  }

  pieChart.setOption(option, true)
  pieChart.resize()
}, 150)

watch(() => [props.data, props.game, props.i18n, props.typeMap], () => {
  updateChart()
})

onMounted(() => {
  updateChart()
  window.addEventListener('resize', updateChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateChart)
  if (pieChart) {
    pieChart.dispose()
    pieChart = null
  }
})
</script>
