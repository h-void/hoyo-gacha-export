const gachaTypeRaw = require('./gachaType.json')
const { createPendingAdapter } = require('../createPendingAdapter')

module.exports = createPendingAdapter({
  id: 'petitplanet',
  gameBiz: 'hyg_cn',
  portableJsonKey: 'hyg',
  order: ['hyg_event', 'hyg_standard'],
  gachaTypeRaw,
  statusTag: 'upcoming',
  platformHint: 'PC / iOS / Android',
  releaseHint: '2026-12-04'
})
