const itemTypeNameMap = require('./gachaType.json')

const order = ['301', '302', '200', '500', '100']

function convertItemTypeMap(mapObject) {
  const convertedItemTypeMap = new Map()
  if (!Array.isArray(mapObject)) return convertedItemTypeMap
  order.forEach(id => {
    const itemType = mapObject.find(item => item.key === id)
    if (itemType) {
      convertedItemTypeMap.set(itemType.key, itemType.name)
    }
  })
  return convertedItemTypeMap
}

function getItemTypeNameMap(language = 'zh-cn') {
  const normalized = String(language || 'zh-cn').toLowerCase()
  let lang = normalized
  if (!itemTypeNameMap[lang]) {
    if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-hant')) {
      lang = 'zh-tw'
    } else if (normalized.startsWith('zh')) {
      lang = 'zh-cn'
    } else {
      const short = normalized.split('-')[0]
      lang = Object.keys(itemTypeNameMap).find(key => key === short || key.startsWith(short + '-')) || 'en-us'
    }
  }
  return convertItemTypeMap(itemTypeNameMap[lang] || itemTypeNameMap['en-us'])
}

module.exports = {
  order,
  convertItemTypeMap,
  getItemTypeNameMap
}
