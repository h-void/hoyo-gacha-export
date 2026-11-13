const fs = require('fs-extra')
const os = require('os')
const path = require('path')

const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoyo-gacha-test-'))
process.env.HOYO_USER_DATA_PATH = tmpUserDataDir

const ExcelJS = require('../src/main/module/exceljs.min.js')
const Ajv2020 = require('ajv/dist/2020')
const uigf41Schema = require('../src/games/genshin/schema/uigf4_1.json')
const uigf30Schema = require('../src/games/genshin/schema/uigf3_0.json')
const Ajv = require('ajv')

const validateUigf41 = new Ajv2020({ strict: false }).compile(uigf41Schema)
const validateUigf30 = new Ajv({ strict: false }).compile(uigf30Schema)

const {
  GAME_IDS,
  detectDataGame,
  getGameAdapter,
  gameI18n
} = require('../src/games/registry')
const utils = require('../src/main/utils')
const config = require('../src/main/config')
const i18n = require('../src/main/i18n')
const { createWorkbookBuffer } = require('../src/main/excel')
const {
  migrateLegacyFiles,
  readData,
  saveData,
  deleteData,
  switchGame,
  getData,
  getDataPayload
} = require('../src/main/getData')
const {
  generateUigf41Json,
  generateUigf30Json,
  importParsedJson,
  inferTimezoneFromUid
} = require('../src/main/UIGFJson')

afterAll(async () => {
  await fs.remove(tmpUserDataDir)
})

describe('game registry & detection', () => {
  test('registers all three games with expected adapters and i18n packs', () => {
    expect(GAME_IDS).toEqual(['genshin', 'starrail', 'zzz'])
    expect(getGameAdapter('genshin').queryParamKey).toBe('gacha_type')
    expect(getGameAdapter('starrail').getGachaLogUrl('https://api.example.com', '21', 'authkey=abc')).toContain('getLdGachaLog')
    expect(getGameAdapter('zzz').queryParamKey).toBe('real_gacha_type')
    expect(getGameAdapter('zzz').serverTimeZone.get('prod_gf_us')).toBe(-5)
  })

  test('detectDataGame accurately identifies legacy local JSON payloads across all 3 games', () => {
    expect(detectDataGame({
      uid: '10001',
      result: [['301', [['2022-01-01 00:00:00', '刻晴', '角色', 5, '301', '1']]]]
    })).toBe('genshin')

    expect(detectDataGame({
      uid: '10001',
      result: [['500', []]]
    })).toBe('genshin')

    expect(detectDataGame({
      uid: '20001',
      result: [['21', [{ id: '1', name: 'Saber', item_type: 'Character', rank_type: '5' }]]]
    })).toBe('starrail')

    expect(detectDataGame({
      uid: '30001',
      result: [['102', [{ id: '1', name: 'Ellen', item_type: 'Agents', rank_type: '4' }]]]
    })).toBe('zzz')

    expect(detectDataGame({
      uid: '30002',
      result: [['1', [{ id: '1', name: 'Original Resin', item_type: '音擎', rank_type: '2' }]]]
    })).toBe('zzz')

    expect(detectDataGame({
      uid: '30003',
      result: [['2', []]],
      typeMap: [['2', '独家频段']]
    })).toBe('zzz')
  })
})

describe('i18n & utils', () => {
  test('resolves complete UI, log, excel, and uigf bundles for all 3 games x 13 languages', () => {
    const langs = Object.keys(gameI18n.genshin)
    expect(langs.length).toBe(13)
    for (const gameId of GAME_IDS) {
      for (const lang of langs) {
        const bundle = i18n.forGame(gameId, lang)
        expect(bundle.ui.win.appTitle).toBeTruthy()
        expect(bundle.ui.game[gameId]).toBeTruthy()
        expect(bundle.ui.setting.hideHiddenPool).toBeTruthy()
        expect(bundle.log.file.notFound).toBeTruthy()
        expect(bundle.excel.header.name).toBeTruthy()
        expect(bundle.ui.about.creditsTitle).toBeTruthy()
      }
    }
    expect(i18n.parse('Page ${page}, retry ${count}', { page: 2, count: 1 })).toBe('Page 2, retry 1')
  })

  test('converts ZZZ server timezone accurately and masks authkey', () => {
    expect(utils.convertTimeZone('2024-07-04 20:00:00', 8, -5)).toBe('2024-07-04 07:00:00')
    expect(utils.convertTimeZone('2024-07-04 20:00:00', -5, 8)).toBe('2024-07-05 09:00:00')
    expect(utils.authkeyMask('https://example.com?authkey=secretValue%2B123&lang=zh-cn')).toBe(
      'https://example.com?authkey=***&lang=zh-cn'
    )
    expect(inferTimezoneFromUid('600000001')).toBe(-5)
    expect(inferTimezoneFromUid('700000001')).toBe(1)
    expect(inferTimezoneFromUid('100000001')).toBe(8)
  })
})

describe('multi-game config & legacy migration', () => {
  test('persists isolated game configs with encrypted URLs and reloads them', async () => {
    await config.ready
    config.currentGame = 'starrail'
    config.logType = 2
    config.hideHiddenPool = true
    config.getUrlsMap('starrail').set('20001', 'https://public-operation-hkrpg.mihoyo.com?authkey=srsecret')
    config.currentGame = 'zzz'
    config.logType = 1
    config.getUrlsMap('zzz').set('30001', 'https://public-operation-nap.mihoyo.com?authkey=zzzsecret')
    await config.save()

    await config.reload()
    expect(config.currentGame).toBe('zzz')
    expect(config.getGameConfig('starrail').logType).toBe(2)
    expect(config.getGameConfig('starrail').hideHiddenPool).toBe(true)
    expect(config.getUrlsMap('starrail').get('20001')).toContain('srsecret')
    expect(config.getGameConfig('zzz').logType).toBe(1)
    expect(config.getUrlsMap('zzz').get('30001')).toContain('zzzsecret')
  })

  test('migrates legacy root gacha-list JSON files into game subdirectories', async () => {
    await fs.outputJSON(path.join(tmpUserDataDir, 'gacha-list-100000001.json'), {
      uid: '100000001',
      lang: 'zh-cn',
      time: Date.now(),
      typeMap: [['301', '角色活动祈愿']],
      result: [['301', [['2023-01-01 12:00:00', '刻晴', '角色', 5, '301', '1672574400000000001']]]]
    })
    await fs.outputJSON(path.join(tmpUserDataDir, 'gacha-list-800000002.json'), {
      uid: '800000002',
      lang: 'en-us',
      time: Date.now(),
      typeMap: [['11', 'Character Event Warp']],
      result: [['11', [{
        id: '1682521800010412850',
        gacha_id: '2001',
        gacha_type: '11',
        item_id: '1003',
        count: '1',
        time: '2023-04-26 12:00:00',
        name: 'Himeko',
        item_type: 'Character',
        rank_type: '5'
      }]]]
    })
    await fs.outputJSON(path.join(tmpUserDataDir, 'gacha-list-1300000003.json'), {
      uid: '1300000003',
      lang: 'en-us',
      time: Date.now(),
      typeMap: [['102', 'Exclusive Re-Screening']],
      result: [['102', [{
        id: '1720000000000000001',
        gacha_id: '200001',
        gacha_type: '102',
        item_id: '1011',
        count: '1',
        time: '2025-01-01 12:00:00',
        name: 'Ellen',
        item_type: 'Agents',
        rank_type: '4'
      }]]]
    })

    await migrateLegacyFiles()
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'genshin', 'gacha-list-100000001.json'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'starrail', 'gacha-list-800000002.json'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'zzz', 'gacha-list-1300000003.json'))).toBe(true)

    await readData(true)
    const switched = await switchGame('starrail')
    expect(switched.game).toBe('starrail')
    expect(switched.dataMap.has('800000002')).toBe(true)
    expect(switched.allAccounts.genshin.length).toBe(1)
    expect(switched.allAccounts.starrail.length).toBe(1)
    expect(switched.allAccounts.zzz.length).toBe(1)

    await deleteData('1300000003', true, 'zzz')
    const afterDelete = getDataPayload('zzz')
    expect(afterDelete.allAccounts.zzz.length).toBe(0)
    expect(afterDelete.allDataList.find(d => d.uid === '1300000003').deleted).toBe(true)
    await deleteData('1300000003', false, 'zzz')
    expect(getDataPayload('zzz').allAccounts.zzz.length).toBe(1)
  })
})

describe('Excel & UIGF v4.1 / v3.0 / SRGF', () => {
  beforeAll(async () => {
    // Seed cached item-id-dict.json for offline Genshin UIGF export tests
    await fs.outputJSON(path.join(tmpUserDataDir, 'item-id-dict.json'), {
      lang: {
        chs: {
          '刻晴': '10000042',
          '西风剑': '11401'
        },
        en: {
          'Keqing': '10000042',
          'Favonius Sword': '11401'
        }
      },
      md5: {}
    })
  })

  test('exports styled Excel buffers for Genshin (incl. wish2), Star Rail, and ZZZ (S/A/B ranks)', async () => {
    const genshinData = {
      uid: '100000001',
      lang: 'zh-cn',
      result: new Map([
        ['301', [
          ['2023-01-01 12:00:00', '西风剑', '武器', 4, '400', '1001'],
          ['2023-01-01 12:01:00', '刻晴', '角色', 5, '400', '1002']
        ]]
      ]),
      typeMap: new Map([['301', '角色活动祈愿']])
    }
    const gsBuf = await createWorkbookBuffer(genshinData, 'genshin', i18n.forGame('genshin', 'zh-cn'))
    const gsWb = new ExcelJS.Workbook()
    await gsWb.xlsx.load(gsBuf)
    expect(gsWb.getWorksheet('rawData').rowCount).toBe(3)
    const gsSheet = gsWb.worksheets[0]
    expect(gsSheet.getRow(3).getCell(6).value).toBe(2) // pity
    expect(gsSheet.getRow(3).getCell(7).value).toBe('祈愿2')

    const hsrData = {
      uid: '800000002',
      lang: 'zh-cn',
      result: new Map([
        ['21', [
          { id: '1', gacha_id: '2001', gacha_type: '21', item_id: '1003', count: '1', time: '2025-07-11 12:00:00', name: 'Saber', item_type: '角色', rank_type: '5' },
          { id: '2', gacha_id: '2001', gacha_type: '21', item_id: '21000', count: '1', time: '2025-07-11 12:00:05', name: '物穰', item_type: '光锥', rank_type: '3' }
        ]]
      ]),
      typeMap: new Map([['21', '角色联动跃迁']])
    }
    const hsrBuf = await createWorkbookBuffer(hsrData, 'starrail', i18n.forGame('starrail', 'zh-cn'))
    const hsrWb = new ExcelJS.Workbook()
    await hsrWb.xlsx.load(hsrBuf)
    expect(hsrWb.getWorksheet('角色联动跃迁').getRow(3).getCell(6).value).toBe(1) // pity reset after rank 5
    expect(hsrWb.getWorksheet('rawData').rowCount).toBe(3)

    const zzzData = {
      uid: '1300000003',
      lang: 'zh-cn',
      result: new Map([
        ['2', [
          { id: '1', gacha_id: '2001', gacha_type: '2', item_id: '12001', count: '1', time: '2025-01-01 12:00:00', name: '月相', item_type: '音擎', rank_type: '2' },
          { id: '2', gacha_id: '2001', gacha_type: '2', item_id: '1011', count: '1', time: '2025-01-01 12:00:05', name: '艾莲', item_type: '代理人', rank_type: '4' },
          { id: '3', gacha_id: '2001', gacha_type: '2', item_id: '12002', count: '1', time: '2025-01-01 12:00:10', name: '安比', item_type: '代理人', rank_type: '3' }
        ]],
        ['102', [
          { id: '4', gacha_id: '2002', gacha_type: '102', item_id: '1011', count: '1', time: '2025-01-02 12:00:00', name: '艾莲', item_type: '代理人', rank_type: '4' }
        ]]
      ]),
      typeMap: new Map([['2', '独家频段'], ['102', '独家重映']])
    }
    const zzzBuf = await createWorkbookBuffer(zzzData, 'zzz', i18n.forGame('zzz', 'zh-cn'))
    const zzzWb = new ExcelJS.Workbook()
    await zzzWb.xlsx.load(zzzBuf)
    const exclusiveSheet = zzzWb.getWorksheet('独家频段')
    expect(exclusiveSheet.getRow(2).getCell(4).value).toBe('B级')
    expect(exclusiveSheet.getRow(3).getCell(4).value).toBe('S级')
    expect(exclusiveSheet.getRow(3).getCell(6).value).toBe(2)
    expect(exclusiveSheet.getRow(4).getCell(4).value).toBe('A级')
    expect(exclusiveSheet.getRow(4).getCell(6).value).toBe(1) // pity reset after S-rank
    expect(zzzWb.getWorksheet('独家重映')).toBeDefined()
    expect(zzzWb.getWorksheet('rawData').rowCount).toBe(5)
  })

  test('exports valid cross-game UIGF v4.1 and imports UIGF v4.1 / v3.0 / SRGF v1.0', async () => {
    await saveData({
      uid: '100000001',
      lang: 'zh-cn',
      time: Date.now(),
      deleted: false,
      typeMap: new Map([['301', '角色活动祈愿']]),
      result: new Map([
        ['301', [['2023-01-01 12:00:00', '刻晴', '角色', 5, '301', '1672574400000000001']]]
      ])
    }, null, 'genshin')

    await saveData({
      uid: '800000002',
      lang: 'en-us',
      time: Date.now(),
      deleted: false,
      region_time_zone: 8,
      typeMap: new Map([['21', 'Character Collaboration Warp']]),
      result: new Map([
        ['21', [{
          id: '1682521800010412850',
          gacha_id: '2001',
          gacha_type: '21',
          item_id: '1003',
          count: '1',
          time: '2025-07-11 12:00:00',
          name: 'Himeko',
          item_type: 'Character',
          rank_type: '5'
        }]]
      ])
    }, null, 'starrail')

    await saveData({
      uid: '1300000003',
      lang: 'en-us',
      time: Date.now(),
      deleted: false,
      region_time_zone: 8,
      typeMap: new Map([['102', 'Exclusive Re-Screening'], ['103', 'W-Engine Reverberation']]),
      result: new Map([
        ['102', [{
          id: '1720000000000000001',
          gacha_id: '200001',
          gacha_type: '102',
          item_id: '1011',
          count: '1',
          time: '2025-01-01 12:00:00',
          name: 'Ellen',
          item_type: 'Agents',
          rank_type: '4'
        }]],
        ['103', [{
          id: '1720000000000000002',
          gacha_id: '300001',
          gacha_type: '103',
          item_id: '14101',
          count: '1',
          time: '2025-01-01 12:05:00',
          name: 'Deep Sea Visitor',
          item_type: 'W-Engines',
          rank_type: '4'
        }]]
      ])
    }, null, 'zzz')

    await readData(true)

    const uigf41 = await generateUigf41Json([
      { game: 'genshin', uid: '100000001' },
      { game: 'starrail', uid: '800000002' },
      { game: 'zzz', uid: '1300000003' }
    ])
    expect(validateUigf41(uigf41)).toBe(true)
    expect(uigf41.info.export_app).toBe('hoyo-gacha-export')
    expect(uigf41.hk4e[0].list[0].item_id).toBe('10000042')
    expect(uigf41.nap[0].list.map(x => x.gacha_type)).toEqual(['102', '103'])

    const uigf30 = await generateUigf30Json('100000001')
    expect(validateUigf30(uigf30)).toBe(true)
    expect(uigf30.info.export_app).toBe('hoyo-gacha-export')

    // Import cross-game UIGF 4.1 (including missing idJson entry fallback)
    uigf41.nap[0].list.push({
      gacha_id: '200001',
      gacha_type: '5',
      item_id: '999999999',
      count: '1',
      time: '2025-01-02 12:00:00',
      name: 'Unknown Bangboo',
      item_type: 'Bangboo',
      rank_type: '3',
      id: '1720000000000000003'
    })
    const importedGames = await importParsedJson(uigf41)
    expect(importedGames).toEqual(['genshin', 'starrail', 'zzz'])
    expect(getData('zzz').dataMap.get('1300000003').result.get('5')[0].name).toBe('Unknown Bangboo')

    // Import SRGF v1.0
    const srgfGames = await importParsedJson({
      info: {
        uid: '800000099',
        lang: 'zh-cn',
        region_time_zone: 8,
        srgf_version: 'v1.0'
      },
      list: [{
        gacha_id: '2001',
        gacha_type: '11',
        item_id: '1003',
        count: '1',
        time: '2024-01-01 00:00:00',
        name: '姬子',
        item_type: '角色',
        rank_type: '5',
        id: '1700000000000000001'
      }]
    })
    expect(srgfGames).toEqual(['starrail'])
    expect(getData('starrail').dataMap.get('800000099').result.get('11')).toHaveLength(1)
  })
})

describe('renderer gachaDetail statistics', () => {
  test('computes pull statistics and localized types accurately across Genshin, HSR, and ZZZ', () => {
    const esbuild = require('esbuild')
    const Module = require('module')

    const utilsCode = fs.readFileSync(path.join(__dirname, '../src/renderer/utils.js'), 'utf8')
    const gachaDetailCode = fs.readFileSync(path.join(__dirname, '../src/renderer/gachaDetail.js'), 'utf8')

    const compiledUtils = esbuild.transformSync(utilsCode, { loader: 'js', format: 'cjs' }).code
    const compiledDetail = esbuild.transformSync(gachaDetailCode, { loader: 'js', format: 'cjs' }).code

    const stubReq = (id) => {
      if (id === '@element-plus/icons-vue') return {}
      throw new Error(`Unexpected import ${id}`)
    }
    const utilsMod = { exports: {} }
    new Function('require', 'module', 'exports', compiledUtils)(stubReq, utilsMod, utilsMod.exports)

    const detailMod = { exports: {} }
    new Function('require', 'module', 'exports', compiledDetail)(
      (id) => (id === './utils' ? utilsMod.exports : stubReq(id)),
      detailMod,
      detailMod.exports
    )

    const gachaDetail = detailMod.exports.default

    // ZZZ stats with localized Japanese / Korean / English type labels
    const zzzStats = gachaDetail(new Map([
      ['5', [
        { time: '2025-01-01 00:00:00', name: 'B-Engine', item_type: 'W-Engines', rank_type: '2' },
        { time: '2025-01-01 00:00:01', name: 'Nicole', item_type: 'Agents', rank_type: '3' },
        { time: '2025-01-01 00:00:02', name: 'Butler', item_type: 'ボンプ', rank_type: '4' },
        { time: '2025-01-01 00:00:03', name: 'Sharkboo', item_type: '「Bangboo」', rank_type: '3' }
      ]]
    ]), 'zzz')

    const d5 = zzzStats.get('5')
    expect(d5.total).toBe(4)
    expect(d5.count2).toBe(1)
    expect(d5.count3).toBe(2)
    expect(d5.count4).toBe(1)
    expect(d5.count4b).toBe(1)
    expect(d5.count3b).toBe(1)
    expect(d5.countMio).toBe(1)
    expect(d5.ssrPos[0]).toEqual(['Butler', 3, '2025-01-01 00:00:02', '5'])

    // Genshin stats preserving wishType '400' in pool '301'
    const gsStats = gachaDetail(new Map([
      ['301', [
        ['2023-01-01 00:00:00', '西风剑', '武器', 4, '400'],
        ['2023-01-01 00:00:01', '夜兰', '角色', 5, '400']
      ]]
    ]), 'genshin')
    expect(gsStats.get('301').ssrPos[0][3]).toBe('400')
    expect(gsStats.get('301').count5c).toBe(1)
  })
})
