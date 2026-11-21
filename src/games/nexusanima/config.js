const gachaTypeRaw = require('./gachaType.json')
const { createPendingAdapter } = require('../createPendingAdapter')

module.exports = createPendingAdapter({
  id: 'nexusanima',
  gameBiz: 'hna_cn',
  portableJsonKey: 'hna',
  order: ['hna_event', 'hna_standard'],
  gachaTypeRaw,
  statusTag: 'upcoming',
  platformHint: 'PC / iOS / Android',
  releaseHint: '2027 Spring'
})
