const fs = require('fs-extra')
const os = require('os')
const path = require('path')

const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoyo-gacha-test-'))
process.env.HOYO_USER_DATA_PATH = tmpUserDataDir

const ExcelJS = require('../src/main/module/exceljs.min.js')
const Ajv2020 = require('ajv/dist/2020')
const uigf42Schema = require('../src/games/genshin/schema/uigf4_2.json')
const uigf41Schema = require('../src/games/genshin/schema/uigf4_1.json')
const uigf30Schema = require('../src/games/genshin/schema/uigf3_0.json')
const Ajv = require('ajv')

const validateUigf42 = new Ajv2020({ strict: false }).compile(uigf42Schema)
const validateUigf41 = new Ajv2020({ strict: false }).compile(uigf41Schema)
const validateUigf30 = new Ajv({ strict: false }).compile(uigf30Schema)

const {
  GAME_IDS,
  detectDataGame,
  getGameAdapter,
  gameI18n
} = require('../src/games/registry')
const { normalizeBeyondLang, getSubPoolLabel } = require('../src/games/beyond/gachaTypeMap')
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
  getDataPayload,
  getQuerystring,
  normalizeLoadedData
} = require('../src/main/getData')
const {
  generateUigf41Json,
  generateUigf42Json,
  generateUigf30Json,
  importParsedJson,
  inferTimezoneFromUid
} = require('../src/main/UIGFJson')

afterAll(async () => {
  await fs.remove(tmpUserDataDir)
})

describe('game registry & detection', () => {
  test('registers all four games with expected adapters and i18n packs', () => {
    expect(GAME_IDS).toEqual(['genshin', 'starrail', 'zzz', 'beyond'])
    expect(getGameAdapter('genshin').queryParamKey).toBe('gacha_type')
    expect(getGameAdapter('starrail').getGachaLogUrl('https://api.example.com', '21', 'authkey=abc')).toContain('getLdGachaLog')
    expect(getGameAdapter('zzz').queryParamKey).toBe('real_gacha_type')
    expect(getGameAdapter('zzz').serverTimeZone.get('prod_gf_us')).toBe(-5)

    const beyond = getGameAdapter('beyond')
    expect(beyond.uigfKey).toBe('hk4e_ugc')
    expect(beyond.queryParamKey).toBe('gacha_type')
    expect(beyond.pageSize).toBe(5)
    expect(beyond.getValidationUrl('https://public-operation-hk4e.mihoyo.com', 'authkey=abc')).toContain('/gacha_info/api/getBeyondGachaLog?authkey=abc&gacha_type=1000&page=1&size=5&end_id=0')
    expect(beyond.getGachaLogUrl('https://public-operation-hk4e-sg.hoyoverse.com', '2000', 'authkey=abc')).toContain('getBeyondGachaLog')
    expect(beyond.getFallbackUidUrls('https://public-operation-hk4e.mihoyo.com', 'authkey=abc')[0]).toContain('/gacha_info/api/getGachaLog?')
    expect(beyond.normalizePoolKey('20021')).toBe('2000')
    expect(beyond.normalizePoolKey('1000')).toBe('1000')
  })

  test('detectDataGame accurately identifies legacy local JSON payloads across all 4 games', () => {
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

    expect(detectDataGame({
      uid: '10004',
      result: [['2000', []]]
    })).toBe('beyond')

    // Beyond 2-star items must not be misclassified as ZZZ
    expect(detectDataGame({
      uid: '10005',
      result: [['custom', [{ id: '1', item_name: 'Casual Hat', item_type: 'Cosmetic Component', rank_type: '2', op_gacha_type: '1000' }]]]
    })).toBe('beyond')

    expect(detectDataGame({
      uid: '10006',
      result: [['custom', []]],
      typeMap: [['2000', '活动颂愿']]
    })).toBe('beyond')
  })
})

describe('i18n, Beyond language normalization & URL regex', () => {
  test('resolves complete UI, log, excel, and uigf bundles for all 4 games x 13 languages', () => {
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

  test('normalizes Beyond languages, extracts data_2 cache URLs cleanly, and builds full-lang API params', () => {
    expect(normalizeBeyondLang('en')).toBe('en-us')
    expect(normalizeBeyondLang('ja')).toBe('ja-jp')
    expect(normalizeBeyondLang('zh-hk')).toBe('zh-tw')
    expect(normalizeBeyondLang('zh-CN')).toBe('zh-cn')
    expect(normalizeBeyondLang('invalid')).toBe('')
    expect(getSubPoolLabel('20011', 'zh-cn')).toBe('活动颂愿·男')
    expect(getSubPoolLabel('20022', 'en-us')).toBe('Event Ode · Female 2')

    const beyond = getGameAdapter('beyond')
    const mockCacheBuffer =
      '1/0/https://other.example.com/foo\x00\x01' +
      '1/0/https://gs.hoyoverse.com/genshin/event/e20250716gacha/index.html?lang=en&authkey=abc%2B123&game_biz=hk4e_global#/log\x00trailing_bytes'
    const matched = mockCacheBuffer.match(beyond.urlRegex)
    expect(matched).toHaveLength(1)
    expect(matched[0]).toBe('https://gs.hoyoverse.com/genshin/event/e20250716gacha/index.html?lang=en&authkey=abc%2B123&game_biz=hk4e_global#/log')

    const params = getQuerystring(matched[0] + '&page=1&size=5&gacha_type=2000&end_id=0', 'beyond')
    expect(params.get('lang')).toBe('en-us')
    expect(params.has('page')).toBe(false)
    expect(params.has('size')).toBe(false)
    expect(params.has('gacha_type')).toBe(false)
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
  test('persists isolated game configs with encrypted URLs across all 4 games and reloads them', async () => {
    await config.ready
    config.currentGame = 'starrail'
    config.logType = 2
    config.hideHiddenPool = true
    config.getUrlsMap('starrail').set('20001', 'https://public-operation-hkrpg.mihoyo.com?authkey=srsecret')
    config.currentGame = 'beyond'
    config.logType = 1
    config.hideHiddenPool = true
    config.getUrlsMap('beyond').set('100000004', 'https://public-operation-hk4e.mihoyo.com?authkey=beyondsecret')
    config.currentGame = 'zzz'
    config.logType = 1
    config.getUrlsMap('zzz').set('30001', 'https://public-operation-nap.mihoyo.com?authkey=zzzsecret')
    await config.save()

    await config.reload()
    expect(config.currentGame).toBe('zzz')
    expect(config.getGameConfig('starrail').logType).toBe(2)
    expect(config.getGameConfig('starrail').hideHiddenPool).toBe(true)
    expect(config.getUrlsMap('starrail').get('20001')).toContain('srsecret')
    expect(config.getGameConfig('beyond').hideHiddenPool).toBe(true)
    expect(config.getUrlsMap('beyond').get('100000004')).toContain('beyondsecret')
    expect(config.value().games.beyond.hideHiddenPool).toBe(true)
    expect(config.getGameConfig('zzz').logType).toBe(1)
    expect(config.getUrlsMap('zzz').get('30001')).toContain('zzzsecret')
  })

  test('migrates legacy root gacha-list JSON files into game subdirectories and normalizes beyond pools', async () => {
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
    await fs.outputJSON(path.join(tmpUserDataDir, 'gacha-list-100000004.json'), {
      uid: '100000004',
      lang: 'zh-cn',
      time: Date.now(),
      typeMap: [['2000', '活动颂愿'], ['1000', '常驻颂愿']],
      result: [['2000', [{
        id: '1760000000000000001',
        schedule_id: '501',
        op_gacha_type: '20011',
        item_id: '410001',
        item_type: '装扮套装',
        item_name: '星屿浮梦',
        rank_type: '5',
        time: '2025-10-22 12:00:00'
      }]]]
    })

    await migrateLegacyFiles()
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'genshin', 'gacha-list-100000001.json'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'starrail', 'gacha-list-800000002.json'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'zzz', 'gacha-list-1300000003.json'))).toBe(true)
    expect(await fs.pathExists(path.join(tmpUserDataDir, 'beyond', 'gacha-list-100000004.json'))).toBe(true)

    await readData(true)
    const switched = await switchGame('starrail')
    expect(switched.game).toBe('starrail')
    expect(switched.dataMap.has('800000002')).toBe(true)
    expect(switched.allAccounts.genshin.length).toBe(1)
    expect(switched.allAccounts.starrail.length).toBe(1)
    expect(switched.allAccounts.zzz.length).toBe(1)
    expect(switched.allAccounts.beyond.length).toBe(1)

    const beyondLoaded = await switchGame('beyond')
    expect(beyondLoaded.game).toBe('beyond')
    expect(beyondLoaded.dataMap.get('100000004').result.get('2000')[0].name).toBe('星屿浮梦')

    // Sub-pool collapse normalization check
    const collapsed = normalizeLoadedData({
      uid: '100000004',
      lang: 'zh-cn',
      result: [
        ['20021', [{ id: '2', schedule_id: '502', op_gacha_type: '20021', item_id: '102', item_type: '装扮套装', item_name: 'B', rank_type: '5', time: '2025-10-22 12:01:00' }]],
        ['20011', [{ id: '1', schedule_id: '501', op_gacha_type: '20011', item_id: '101', item_type: '装扮部件', item_name: 'A', rank_type: '4', time: '2025-10-22 12:00:00' }]]
      ]
    }, 'beyond')
    expect(Array.from(collapsed.result.keys())).toEqual(['2000'])
    expect(collapsed.result.get('2000').map(i => i.id)).toEqual(['1', '2'])

    await deleteData('1300000003', true, 'zzz')
    const afterDelete = getDataPayload('zzz')
    expect(afterDelete.allAccounts.zzz.length).toBe(0)
    expect(afterDelete.allDataList.find(d => d.uid === '1300000003').deleted).toBe(true)
    await deleteData('1300000003', false, 'zzz')
    expect(getDataPayload('zzz').allAccounts.zzz.length).toBe(1)
  })
})

describe('Excel & UIGF v4.2 / v4.1 / v3.0 / SRGF', () => {
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

  test('exports styled Excel buffers for Genshin, Star Rail, ZZZ, and Beyond (Event 5★ & Standard 4★ pity + sub-banners)', async () => {
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

    const beyondData = {
      uid: '100000004',
      lang: 'zh-cn',
      result: new Map([
        ['2000', [
          { id: '1', schedule_id: '501', op_gacha_type: '20011', gacha_type: '2000', item_id: '1', item_type: '装扮形录', name: '蓝纹斗篷', item_name: '蓝纹斗篷', rank_type: '3', time: '2025-10-22 12:00:00' },
          { id: '2', schedule_id: '501', op_gacha_type: '20021', gacha_type: '2000', item_id: '2', item_type: '装扮套装', name: '星屿浮梦', item_name: '星屿浮梦', rank_type: '5', time: '2025-10-22 12:00:05' },
          { id: '3', schedule_id: '501', op_gacha_type: '20012', gacha_type: '2000', item_id: '3', item_type: '互动动作', name: '起舞', item_name: '起舞', rank_type: '4', time: '2025-10-22 12:00:10' }
        ]],
        ['1000', [
          { id: '4', schedule_id: '101', op_gacha_type: '1000', gacha_type: '1000', item_id: '4', item_type: '装扮部件', name: '棉帽', item_name: '棉帽', rank_type: '2', time: '2025-10-22 12:01:00' },
          { id: '5', schedule_id: '101', op_gacha_type: '1000', gacha_type: '1000', item_id: '5', item_type: '互动表情', name: '开心', item_name: '开心', rank_type: '3', time: '2025-10-22 12:01:05' },
          { id: '6', schedule_id: '101', op_gacha_type: '1000', gacha_type: '1000', item_id: '6', item_type: '装扮套装', name: '晚风轻吟', item_name: '晚风轻吟', rank_type: '4', time: '2025-10-22 12:01:10' },
          { id: '7', schedule_id: '101', op_gacha_type: '1000', gacha_type: '1000', item_id: '7', item_type: '装扮部件', name: '帆布鞋', item_name: '帆布鞋', rank_type: '2', time: '2025-10-22 12:01:15' }
        ]]
      ]),
      typeMap: new Map([['2000', '活动颂愿'], ['1000', '常驻颂愿']])
    }
    const beyondBuf = await createWorkbookBuffer(beyondData, 'beyond', i18n.forGame('beyond', 'zh-cn'))
    const beyondWb = new ExcelJS.Workbook()
    await beyondWb.xlsx.load(beyondBuf)
    const eventOdeSheet = beyondWb.getWorksheet('活动颂愿')
    expect(eventOdeSheet.getRow(2).getCell(4).value).toBe(3)
    expect(eventOdeSheet.getRow(2).getCell(7).value).toBe('活动颂愿·男')
    expect(eventOdeSheet.getRow(3).getCell(6).value).toBe(2) // 5★ hit
    expect(eventOdeSheet.getRow(3).getCell(7).value).toBe('活动颂愿·女')
    expect(eventOdeSheet.getRow(4).getCell(6).value).toBe(1) // pity reset after 5★
    expect(eventOdeSheet.getRow(4).getCell(7).value).toBe('活动颂愿·男 2')

    const stdOdeSheet = beyondWb.getWorksheet('常驻颂愿')
    expect(stdOdeSheet.getRow(2).getCell(4).value).toBe(2)
    expect(stdOdeSheet.getRow(4).getCell(4).value).toBe(4)
    expect(stdOdeSheet.getRow(4).getCell(6).value).toBe(3) // 4★ hit at pull 3
    expect(stdOdeSheet.getRow(5).getCell(6).value).toBe(1) // pity reset after 4★

    const beyondRaw = beyondWb.getWorksheet('rawData')
    expect(beyondRaw.rowCount).toBe(8)
    expect(beyondRaw.getRow(2).getCell(1).value).toBe('501')
    expect(beyondRaw.getRow(2).getCell(2).value).toBe('20011')
    expect(beyondRaw.getRow(2).getCell(7).value).toBe('蓝纹斗篷')
  })

  test('exports valid cross-game UIGF v4.2 and imports UIGF v4.2 / v4.1 / v3.0 / SRGF v1.0', async () => {
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

    await saveData({
      uid: '600000004',
      lang: '',
      time: Date.now(),
      deleted: false,
      region: 'os_usa',
      typeMap: new Map([['2000', 'Event Ode'], ['1000', 'Standard Ode']]),
      result: new Map([
        ['2000', [{
          id: '1760000000000000001',
          schedule_id: '501',
          op_gacha_type: '20021',
          gacha_type: '2000',
          item_id: '410001',
          item_type: 'Cosmetic Set',
          name: 'Starlight Reverie',
          item_name: 'Starlight Reverie',
          rank_type: '5',
          time: '2025-10-22 12:00:00',
          region: 'os_usa',
          is_up: '1',
          count: '1'
        }]],
        ['1000', [{
          id: '1760000000000000002',
          schedule_id: '101',
          op_gacha_type: '1000',
          gacha_type: '1000',
          item_id: '420001',
          item_type: 'Cosmetic Component',
          name: 'Casual Hat',
          item_name: 'Casual Hat',
          rank_type: '2',
          time: '2025-10-22 12:05:00',
          region: 'os_usa',
          is_up: '0',
          count: '1'
        }]]
      ])
    }, null, 'beyond')

    await readData(true)

    // Backwards-compatible v4.1 export without Beyond
    const uigf41 = await generateUigf41Json([
      { game: 'genshin', uid: '100000001' },
      { game: 'starrail', uid: '800000002' },
      { game: 'zzz', uid: '1300000003' }
    ])
    expect(uigf41.info.version).toBe('v4.1')
    expect(validateUigf41(uigf41)).toBe(true)
    expect(uigf41.hk4e[0].list[0].item_id).toBe('10000042')
    expect(uigf41.nap[0].list.map(x => x.gacha_type)).toEqual(['102', '103'])

    // Full 4-game UIGF v4.2 export including hk4e_ugc
    const uigf42 = await generateUigf42Json([
      { game: 'genshin', uid: '100000001' },
      { game: 'starrail', uid: '800000002' },
      { game: 'zzz', uid: '1300000003' },
      { game: 'beyond', uid: '600000004' }
    ])
    expect(uigf42.info.version).toBe('v4.2')
    expect(validateUigf42(uigf42)).toBe(true)
    expect(uigf42.info.export_app).toBe('hoyo-gacha-export')
    expect(uigf42.hk4e_ugc).toHaveLength(1)
    expect(uigf42.hk4e_ugc[0].timezone).toBe(-5)
    expect('lang' in uigf42.hk4e_ugc[0]).toBe(false) // empty lang must be omitted per schema
    expect(uigf42.hk4e_ugc[0].list[0]).toMatchObject({
      id: '1760000000000000001',
      schedule_id: '501',
      item_name: 'Starlight Reverie',
      op_gacha_type: '20021',
      region: 'os_usa',
      is_up: '1'
    })

    const uigf30 = await generateUigf30Json('100000001')
    expect(validateUigf30(uigf30)).toBe(true)
    expect(uigf30.info.export_app).toBe('hoyo-gacha-export')

    // Import cross-game UIGF v4.2 (including new Beyond sub-pool item and ZZZ item fallback)
    uigf42.nap[0].list.push({
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
    uigf42.hk4e_ugc[0].list.push({
      id: '1760000000000000003',
      schedule_id: '502',
      item_type: 'Interactive Actions',
      item_id: '430001',
      item_name: 'Wave',
      rank_type: '4',
      time: '2025-10-23 12:00:00',
      op_gacha_type: '20012'
    })
    const importedGames = await importParsedJson(uigf42)
    expect(importedGames).toEqual(['genshin', 'starrail', 'zzz', 'beyond'])
    expect(getData('zzz').dataMap.get('1300000003').result.get('5')[0].name).toBe('Unknown Bangboo')
    const importedBeyondPools = getData('beyond').dataMap.get('600000004').result
    expect(importedBeyondPools.get('2000').map(x => x.op_gacha_type)).toEqual(['20021', '20012'])
    expect(importedBeyondPools.get('1000')).toHaveLength(1)

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
  test('computes pull statistics and localized types accurately across Genshin, HSR, ZZZ, and Beyond', () => {
    const esbuild = require('esbuild')

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

    // Beyond stats: Event Ode (2000 -> 5★ pity + op_gacha_type) and Standard Ode (1000 -> 4★ pity + 2★-4★ counts)
    const beyondStats = gachaDetail(new Map([
      ['2000', [
        { time: '2025-10-22 12:00:00', item_name: '蓝纹斗篷', item_type: '装扮形录', rank_type: '3', op_gacha_type: '20011' },
        { time: '2025-10-22 12:00:05', item_name: '星屿浮梦', item_type: '装扮套装', rank_type: '5', op_gacha_type: '20021' },
        { time: '2025-10-22 12:00:10', item_name: '起舞', item_type: '互动动作', rank_type: '4', op_gacha_type: '20012' }
      ]],
      ['1000', [
        { time: '2025-10-22 12:01:00', item_name: '棉帽', item_type: '装扮部件', rank_type: '2', op_gacha_type: '1000' },
        { time: '2025-10-22 12:01:05', item_name: '开心', item_type: '互动表情', rank_type: '3', op_gacha_type: '1000' },
        { time: '2025-10-22 12:01:10', item_name: '晚风轻吟', item_type: '装扮套装', rank_type: '4', op_gacha_type: '1000' },
        { time: '2025-10-22 12:01:15', item_name: '帆布鞋', item_type: '装扮部件', rank_type: '2', op_gacha_type: '1000' }
      ]]
    ]), 'beyond')

    const ev = beyondStats.get('2000')
    expect(ev.total).toBe(3)
    expect(ev.count5).toBe(1)
    expect(ev.count4).toBe(1)
    expect(ev.count3).toBe(1)
    expect(ev.countMio).toBe(1) // 1 pull since 5★
    expect(ev.ssrPos[0]).toEqual(['星屿浮梦', 2, '2025-10-22 12:00:05', '20021'])
    expect(ev.typeMap5.get('装扮套装')).toBe(1)

    const st = beyondStats.get('1000')
    expect(st.total).toBe(4)
    expect(st.count4).toBe(1)
    expect(st.count3).toBe(1)
    expect(st.count2).toBe(2)
    expect(st.countMio).toBe(1) // 1 pull since 4★
    expect(st.ssrPos[0]).toEqual(['晚风轻吟', 3, '2025-10-22 12:01:10', '1000'])
    expect(st.typeMap2.get('装扮部件')).toBe(2)
  })
})

describe('regressions: bundler, soft-delete UID switching, Genshin UIGF merge & UID probing', () => {
  test('Rollup main bundle contains zero unbundled relative require() specifiers', async () => {
    const rollup = require('rollup')
    const mainOptions = require('../.electron-vite/rollup.main.config')('development')
    const bundle = await rollup.rollup({ ...mainOptions, onwarn: () => {} })
    const { output } = await bundle.generate(mainOptions.output)
    await bundle.close()

    const code = output[0].code
    const specifiers = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(m => m[1])
    const relativeRequires = specifiers.filter(spec => spec.startsWith('.'))
    expect(relativeRequires).toEqual([])
  }, 30000)

  test('deleting the currently selected account switches current to remaining active UID or 0', async () => {
    await saveData({
      uid: '300000010',
      lang: 'zh-cn',
      time: Date.now(),
      deleted: false,
      typeMap: new Map([['2', '独家频段']]),
      result: new Map([['2', []]])
    }, null, 'zzz')
    await saveData({
      uid: '300000011',
      lang: 'zh-cn',
      time: Date.now(),
      deleted: false,
      typeMap: new Map([['2', '独家频段']]),
      result: new Map([['2', []]])
    }, null, 'zzz')
    await readData(true)

    config.setGameConfig('zzz', 'current', '300000010')
    await config.save()

    await deleteData('300000010', true, 'zzz')
    expect(getDataPayload('zzz').current).not.toBe('300000010')
    await readData(true)
    const afterFirstDelete = getDataPayload('zzz')
    expect(afterFirstDelete.current).not.toBe('300000010')
    expect(afterFirstDelete.dataMap.get(afterFirstDelete.current)?.deleted).toBeFalsy()

    // Delete all remaining active ZZZ accounts -> current must reset to 0
    for (const acc of afterFirstDelete.allAccounts.zzz) {
      await deleteData(acc.uid, true, 'zzz')
    }
    await readData(true)
    expect(getDataPayload('zzz').current).toBe(0)

    // Restoring an account when current is 0 selects it immediately
    await deleteData('1300000003', false, 'zzz')
    expect(getDataPayload('zzz').current).toBe('1300000003')
  })

  test('importing incremental Genshin UIGF v4.2 and v3.0 merges with existing local history', async () => {
    await saveData({
      uid: '100000888',
      lang: 'zh-cn',
      time: Date.now(),
      deleted: false,
      typeMap: new Map([['301', '角色活动祈愿']]),
      result: new Map([
        ['301', [['2023-01-01 10:00:00', '刻晴', '角色', 5, '301', '1672567200000000001']]]
      ])
    }, null, 'genshin')
    await readData(true)

    await importParsedJson({
      info: {
        export_timestamp: 1700000000,
        export_app: 'test',
        export_app_version: '1.0.0',
        version: 'v4.2'
      },
      hk4e: [{
        uid: '100000888',
        timezone: 8,
        lang: 'zh-cn',
        list: [{
          uigf_gacha_type: '301',
          gacha_type: '400',
          item_id: '10000042',
          count: '1',
          time: '2023-06-01 10:00:00',
          name: '刻晴',
          item_type: '角色',
          rank_type: '5',
          id: '1685613600000000002'
        }]
      }]
    })

    await importParsedJson({
      info: {
        uid: '100000888',
        lang: 'zh-cn',
        export_timestamp: 1700000001,
        export_time: '2023-11-15 00:00:01',
        export_app: 'test',
        export_app_version: '1.0.0',
        uigf_version: 'v3.0'
      },
      list: [{
        uigf_gacha_type: '301',
        gacha_type: '301',
        item_id: '11401',
        count: '1',
        time: '2023-09-01 10:00:00',
        name: '西风剑',
        item_type: '武器',
        rank_type: '4',
        id: '1693562400000000003'
      }]
    })

    const mergedPool = getData('genshin').dataMap.get('100000888').result.get('301')
    expect(mergedPool.map(item => item[5])).toEqual([
      '1672567200000000001',
      '1685613600000000002',
      '1693562400000000003'
    ])
  })

  test('tryGetUid passes end_id=0, falls back to standard wish for Beyond, and prevents 0-pull account overwrite', async () => {
    const http = require('http')
    const { tryGetUid, fetchData } = require('../src/main/getData')
    const beyondAdapter = getGameAdapter('beyond')
    const origGetApiDomain = beyondAdapter.getApiDomain
    const origDefaultDomain = beyondAdapter.defaultApiDomain

    const requestedUrls = []
    let mode = 'fallback-uid'

    const server = http.createServer((req, res) => {
      requestedUrls.push(req.url)
      res.setHeader('Content-Type', 'application/json')
      if (mode === 'fallback-uid') {
        if (req.url.includes('getBeyondGachaLog')) {
          res.end(JSON.stringify({ retcode: -1, message: 'empty beyond', data: null }))
          return
        }
        if (req.url.includes('getGachaLog') && req.url.includes('gacha_type=301')) {
          res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list: [{ uid: '100000777' }] } }))
          return
        }
      }
      res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list: [], region: 'cn_gf01' } }))
    })

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const mockDomain = `http://127.0.0.1:${port}`

    try {
      beyondAdapter.getApiDomain = () => mockDomain
      beyondAdapter.defaultApiDomain = mockDomain
      getQuerystring(`${mockDomain}/event/e20250716gacha/index.html?authkey=testkey&lang=zh-cn`, 'beyond')

      const fallbackUid = await tryGetUid('authkey=testkey&lang=zh-cn', 'beyond')
      expect(fallbackUid).toBe('100000777')
      expect(requestedUrls.some(u => u.includes('getBeyondGachaLog') && u.includes('end_id=0'))).toBe(true)

      // Now simulate an account with 0 pulls everywhere while another account is active
      mode = 'all-empty'
      const savedUrl = 'https://public-operation-hk4e.mihoyo.com?authkey=original_owner'
      await saveData({
        uid: '100000004',
        lang: 'zh-cn',
        time: Date.now(),
        deleted: false,
        typeMap: new Map([['2000', '活动颂愿'], ['1000', '常驻颂愿']]),
        result: new Map([['2000', []], ['1000', []]])
      }, savedUrl, 'beyond')
      config.setGameConfig('beyond', 'current', '100000004')
      await config.save()

      const emptyUid = await tryGetUid('authkey=empty_second_account&lang=zh-cn', 'beyond')
      expect(emptyUid).toBe('')

      await expect(
        fetchData(`${mockDomain}/event/e20250716gacha/index.html?authkey=empty_second_account&lang=zh-cn`, 'beyond')
      ).rejects.toThrow()

      // Active account's encrypted URL must NOT be overwritten by the empty second account
      expect(config.getUrlsMap('beyond').get('100000004')).toBe(savedUrl)
    } finally {
      beyondAdapter.getApiDomain = origGetApiDomain
      beyondAdapter.defaultApiDomain = origDefaultDomain
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('system-proxy is a safe no-op on non-Windows platforms', async () => {
    if (process.platform !== 'win32') {
      const { enableProxy, disableProxy, proxyStatus } = require('../src/main/module/system-proxy')
      await expect(enableProxy('127.0.0.1', 8325)).resolves.toBeUndefined()
      expect(proxyStatus.started).toBe(false)
      await expect(disableProxy()).resolves.toBeUndefined()
    }
  })

  test('extracts clean URLs across Genshin, HSR, ZZZ, and Beyond from packed data_2 binary cache and preserves authkey before #', () => {
    const rawCache = utils.normalizeCacheText(
      '1/0/https://sdk.mihoyo.com/agreement/index.html?bundle_id=1\x00\ufffd' +
      '1/0/https://webstatic.mihoyo.com/csc/index.html?auth_appid=csc&authkey=wrong_csc_key\x00' +
      '1/0/https://webstatic.mihoyo.com/hk4e/event/e20190909gacha-v3/index.html?auth_appid=webview_gacha&authkey=gs_key==&game_biz=hk4e_cn&lang=zh-cn#/log' +
      '1/0/https://public-operation-hkrpg-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?auth_appid=webview_gacha&authkey=hsr_key%2B1&game_biz=hkrpg_global&lang=en-us&end_id=0\x00\ufffd' +
      '1/0/https://public-operation-nap-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?auth_appid=webview_gacha&authkey=zzz_key%2B1&end_id=0&lang=ja-jp&game_biz=nap_global\x00\ufffd'
    )

    const gsMatches = rawCache.match(getGameAdapter('genshin').urlRegex)
    expect(gsMatches).toEqual([
      'https://webstatic.mihoyo.com/hk4e/event/e20190909gacha-v3/index.html?auth_appid=webview_gacha&authkey=gs_key==&game_biz=hk4e_cn&lang=zh-cn#/log'
    ])
    const gsParams = getQuerystring('https://webstatic.mihoyo.com/hk4e/event/gacha/index.html?lang=zh-cn&game_biz=hk4e_cn&authkey=raw+key==#/log', 'genshin')
    expect(gsParams.get('authkey')).toBe('raw+key==')

    const hsrMatches = rawCache.match(getGameAdapter('starrail').urlRegex)
    expect(hsrMatches).toHaveLength(1)
    const hsrParams = getQuerystring(hsrMatches[0], 'starrail')
    expect(hsrParams.get('game_biz')).toBe('hkrpg_global')
    expect(hsrParams.get('lang')).toBe('en-us')

    const zzzMatches = rawCache.match(getGameAdapter('zzz').urlRegex)
    expect(zzzMatches).toHaveLength(1)
    const zzzParams = getQuerystring(zzzMatches[0], 'zzz')
    expect(zzzParams.get('game_biz')).toBe('nap_global')
    expect(zzzParams.get('lang')).toBe('ja-jp')
    expect(zzzParams.get('authkey')).toBe('zzz_key+1')

    // Malformed URL input must return false instead of throwing unhandled TypeError
    expect(getQuerystring('not-a-valid-url', 'genshin')).toBe(false)
  })
})
