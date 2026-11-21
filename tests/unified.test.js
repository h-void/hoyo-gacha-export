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
  GAME_CATALOG,
  PARENT_GAME_IDS,
  ADAPTER_TO_PARENT_GAME,
  ADAPTER_TO_MODE_KEY,
  GAME_IDS,
  ACTIVE_GAME_IDS,
  PENDING_GAME_IDS,
  UIGF_GAME_IDS,
  detectDataGame,
  getGameAdapter,
  getParentGame,
  getGameModes,
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
  normalizeLoadedData,
  getUrl,
  fetchData,
  PROXY_HOST_RE
} = require('../src/main/getData')
const {
  generateUigf41Json,
  generateUigf42Json,
  generateUigf30Json,
  generatePortableGameJson,
  importParsedJson,
  inferTimezoneFromUid
} = require('../src/main/UIGFJson')

afterAll(async () => {
  await fs.remove(tmpUserDataDir)
})

describe('game registry & detection', () => {
  test('registers 6 PC parent games -> 8 mode adapters in two-level GAME_CATALOG with complete i18n labels', () => {
    expect(PARENT_GAME_IDS).toEqual(['genshin', 'starrail', 'zzz', 'bh3', 'petitplanet', 'nexusanima'])
    expect(GAME_CATALOG.filter(g => g.group === 'active').map(g => g.id)).toEqual(['genshin', 'starrail', 'zzz', 'bh3'])
    expect(GAME_CATALOG.filter(g => g.group === 'pending').map(g => g.id)).toEqual(['petitplanet', 'nexusanima'])

    // Mobile-only games must not be registered or displayed
    expect(GAME_IDS).not.toContain('tot')
    expect(GAME_IDS).not.toContain('ggz')

    // Every adapter belongs to exactly one parent game and has a localized mode label
    const catalogAdapterIds = GAME_CATALOG.flatMap(g => g.modes.map(m => m.id))
    expect(new Set(catalogAdapterIds)).toEqual(new Set(GAME_IDS))
    expect(catalogAdapterIds).toHaveLength(GAME_IDS.length)

    expect(getParentGame('beyond').id).toBe('genshin')
    expect(getGameModes('genshin').map(m => m.id)).toEqual(['genshin', 'beyond'])
    expect(getParentGame('starrail_blindbox').id).toBe('starrail')
    expect(getGameModes('starrail').map(m => m.id)).toEqual(['starrail', 'starrail_blindbox'])
    expect(ADAPTER_TO_PARENT_GAME.bh3).toBe('bh3')
    expect(ADAPTER_TO_MODE_KEY.beyond).toBe('beyond')
    expect(ADAPTER_TO_MODE_KEY.starrail_blindbox).toBe('blindbox')

    for (const lang of Object.keys(gameI18n.genshin)) {
      const bundle = i18n.forGame('genshin', lang)
      expect(bundle.ui.gameType.label).toBeTruthy()
      expect(bundle.ui.gameType.allPools).toBeTruthy()
      expect(bundle.ui.common.type).toBeTruthy()
      for (const adapterId of GAME_IDS) {
        const modeKey = ADAPTER_TO_MODE_KEY[adapterId]
        expect(bundle.ui.gameType[modeKey]).toBeTruthy()
      }
    }
  })

  test('registers all eight PC HoYoverse adapters with expected configs and i18n packs', () => {
    expect(ACTIVE_GAME_IDS).toEqual(['genshin', 'beyond', 'starrail', 'starrail_blindbox', 'zzz', 'bh3'])
    expect(PENDING_GAME_IDS).toEqual(['petitplanet', 'nexusanima'])
    expect(UIGF_GAME_IDS).toEqual(['genshin', 'starrail', 'zzz', 'beyond'])
    expect(GAME_IDS).toEqual([...ACTIVE_GAME_IDS, ...PENDING_GAME_IDS])

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

    const bh3 = getGameAdapter('bh3')
    expect(bh3.availability).toBe('active')
    expect(bh3.fetchStrategy).toBe('bh3_self_help')
    expect(bh3.hiddenPoolKey).toBe('bh3_dorm')
    expect(bh3.getApiDomain('webstatic-sea.hoyoverse.com')).toBe('https://public-operation-common-sg.hoyoverse.com')
    expect(bh3.getApiDomain('webstatic.mihoyo.com')).toBe('https://public-operation-common.mihoyo.com')
    expect(bh3.getDefaultPageId('https://public-operation-common-sg.hoyoverse.com', 'bh3_global')).toBe('6')
    expect(bh3.getDefaultPageId('https://public-operation-common.mihoyo.com', 'bh3_cn')).toBe('5')

    const blindbox = getGameAdapter('starrail_blindbox')
    expect(blindbox.availability).toBe('active')
    expect(blindbox.fetchStrategy).toBe('blindbox')
    expect(blindbox.pageSize).toBe(5)
    expect(blindbox.paginationParamKey).toBe('max_id')
    expect(blindbox.getValidationUrl('https://public-operation-hkrpg.mihoyo.com', 'authkey=abc')).toContain('/common/hkrpg_gacha_record/api/getBlindBoxLog?authkey=abc&page=1&size=5&max_id=0')
    expect(blindbox.getFallbackUidUrls('https://public-operation-hkrpg.mihoyo.com', 'authkey=abc')[0]).toContain('/common/hkrpg_gacha_record/api/getGachaLog?')

    for (const pendingId of PENDING_GAME_IDS) {
      const adapter = getGameAdapter(pendingId)
      expect(adapter.availability).toBe('pending')
      expect(adapter.getLogEntries()).toEqual([])
      expect(adapter.uigfKey).toBeNull()
      expect(adapter.portableJsonKey).toBeTruthy()
    }
  })

  test('detectDataGame accurately identifies local JSON payloads across all 8 PC adapters', () => {
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

    // BH3
    expect(detectDataGame({
      uid: '50001',
      result: [['bh3_char_a', [{ id: '1', name: '松雀·欺世之影', item_type: '角色', rank_type: '5', raw_content: '[角色]松雀·欺世之影角色卡' }]]]
    })).toBe('bh3')

    // Starrail BlindBox (must not be misclassified as Beyond even though it has item_name)
    expect(detectDataGame({
      uid: '80001',
      result: [['1001', [{ id: '1', pool_id: '1001', item_name: '稀有猫猫狸', blind_box_sub_rarity: '52', rank_type: '5' }]]]
    })).toBe('starrail_blindbox')

    // Upcoming PC games
    expect(detectDataGame({ uid: '60003', result: [['hyg_event', []]] })).toBe('petitplanet')
    expect(detectDataGame({ uid: '60004', result: [['hna_event', []]] })).toBe('nexusanima')
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

describe('ZZZ 2026 domains, BH3 self-help query, HSR BlindBox, and pending games', () => {
  test('supports ZZZ 2026 public-operation-common & e20230424gacha-v2 URLs without matching BH3 or HSR', () => {
    const zzz = getGameAdapter('zzz')
    expect(zzz.getApiDomain('public-operation-common.mihoyo.com')).toBe('https://public-operation-common.mihoyo.com')
    expect(zzz.getApiDomain('public-operation-common-sg.hoyoverse.com')).toBe('https://public-operation-common-sg.hoyoverse.com')
    expect(zzz.getApiDomain('webstatic-sea.hoyoverse.com')).toBe('https://public-operation-nap-sg.hoyoverse.com')

    const mixedCache = utils.normalizeCacheText(
      '1/0/https://public-operation-common.mihoyo.com/common/bh3_self_help_query/UserGachaQuery/GetUserGacha?auth_appid=csc&authkey=bh3key&game_biz=bh3_cn\x00' +
      '1/0/https://public-operation-hkrpg.mihoyo.com/common/hkrpg_gacha_record/api/getGachaLog?auth_appid=webview_gacha&authkey=hsrkey&game_biz=hkrpg_cn\x00' +
      '1/0/https://act.mihoyo.com/nap/event/e20230424gacha-v2/index.html?auth_appid=webview_gacha&authkey=zzz_v2_key&game_biz=nap_cn#/log\x00' +
      '1/0/https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?auth_appid=webview_gacha&authkey=zzz_common_os&real_gacha_type=2&end_id=0\x00'
    )

    const zzzMatches = mixedCache.match(zzz.urlRegex)
    expect(zzzMatches).toEqual([
      'https://act.mihoyo.com/nap/event/e20230424gacha-v2/index.html?auth_appid=webview_gacha&authkey=zzz_v2_key&game_biz=nap_cn#/log',
      'https://public-operation-common-sg.hoyoverse.com/common/gacha_record/api/getGachaLog?auth_appid=webview_gacha&authkey=zzz_common_os&real_gacha_type=2&end_id=0'
    ])

    // Proxy host regex intercepts act/cs/public-operation-common domains for ZZZ, BlindBox, and BH3
    expect(PROXY_HOST_RE.test('act.mihoyo.com')).toBe(true)
    expect(PROXY_HOST_RE.test('act.hoyoverse.com')).toBe(true)
    expect(PROXY_HOST_RE.test('cs.hoyoverse.com')).toBe(true)
    expect(PROXY_HOST_RE.test('public-operation-common-sg.hoyoverse.com')).toBe(true)
  })

  test('BH3 end-to-end mock HTTP fetch: GetMenus, GetUserGacha pagination, Wiki rank lookup, multiset dedup, Excel & portable/HoYoGet JSON', async () => {
    const http = require('http')
    const bh3Adapter = getGameAdapter('bh3')
    const origGetApiDomain = bh3Adapter.getApiDomain
    const origDefaultDomain = bh3Adapter.defaultApiDomain
    const origGetWikiChannelUrl = bh3Adapter.getWikiChannelUrl

    const receivedHeaders = []
    const bh3Page1 = [
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[角色]松雀·欺世之影角色卡' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]金币*50000' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]金币*50000' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]金币*50000' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]星石*200' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]星石*200' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]星石*200' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]星石*200' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[材料]星石*200' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:00:00' }, { label: '补给内容', value: '[角色]女武神·巡矢角色卡' }] }
    ]
    const bh3Page2 = [
      { item: [{ label: '补给时间', value: '2026-11-09 18:00:00' }, { label: '补给内容', value: '[材料]金币*50000' }] }
    ]
    const equipPage1 = [
      { item: [{ label: '补给时间', value: '2026-11-10 20:05:00' }, { label: '补给内容', value: '[武器]十相全知' }] },
      { item: [{ label: '补给时间', value: '2026-11-10 20:05:00' }, { label: '补给内容', value: '[圣痕]松雀（上）' }] }
    ]

    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')
      if (req.url.includes('/UserMenuQuery/GetMenus')) {
        receivedHeaders.push({ origin: req.headers.origin, referer: req.headers.referer })
        if (req.url.includes('type=2')) {
          res.end(JSON.stringify({
            retcode: 0,
            message: 'OK',
            data: [
              { label: '水晶记录', type: '99' },
              { label: '角色补给A', type: '101' },
              { label: '装备补给A', type: '102' }
            ]
          }))
          return
        }
        res.end(JSON.stringify({ retcode: 0, message: 'OK', data: [] }))
        return
      }
      if (req.url.includes('/UserGachaQuery/GetUserGacha')) {
        if (req.url.includes('type=101')) {
          const list = req.url.includes('page=1') ? bh3Page1 : (req.url.includes('page=2') ? bh3Page2 : [])
          res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list } }))
          return
        }
        if (req.url.includes('type=102')) {
          const list = req.url.includes('page=1') ? equipPage1 : []
          res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list } }))
          return
        }
      }
      if (req.url.includes('channel_id=18')) {
        res.end(JSON.stringify({
          retcode: 0,
          data: {
            list: [{
              list: [
                { title: '松雀·欺世之影', ext: JSON.stringify({ c_18: { filter: { text: ['初始阶级/S'] } } }) },
                { title: '女武神·巡矢', ext: JSON.stringify({ c_18: { filter: { text: ['初始阶级/A'] } } }) }
              ]
            }]
          }
        }))
        return
      }
      if (req.url.includes('channel_id=20')) {
        res.end(JSON.stringify({
          retcode: 0,
          data: {
            list: [{
              list: [
                { title: '十相全知', ext: JSON.stringify({ c_20: { filter: { text: ['星级/五星'] } } }) }
              ]
            }]
          }
        }))
        return
      }
      res.end(JSON.stringify({ retcode: 0, data: { list: [] } }))
    })

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const mockDomain = `http://127.0.0.1:${port}`

    try {
      bh3Adapter.getApiDomain = () => mockDomain
      bh3Adapter.defaultApiDomain = mockDomain
      bh3Adapter.getWikiChannelUrl = (cid) => `${mockDomain}/wiki?channel_id=${cid}`

      const bh3Url = `${mockDomain}/csc-service-center-fe/index.html?auth_appid=csc&authkey=bh3_test_key&game_biz=bh3_cn&community_select_uid=210000123&lang=zh-cn`
      await fetchData(bh3Url, 'bh3')

      expect(receivedHeaders.length).toBeGreaterThan(0)
      expect(receivedHeaders[0].origin).toBe('https://webstatic.mihoyo.com')

      const bh3Data = getData('bh3').dataMap.get('210000123')
      expect(bh3Data).toBeDefined()
      const charPool = bh3Data.result.get('bh3_char_a')
      const equipPool = bh3Data.result.get('bh3_equip_a')
      expect(charPool).toHaveLength(11)
      expect(charPool.filter(x => x.name === '金币*50000')).toHaveLength(4) // 1 from page2 + 3 from page1
      expect(charPool.find(x => x.name === '松雀·欺世之影').rank_type).toBe('5')
      expect(charPool.find(x => x.name === '女武神·巡矢').rank_type).toBe('4')
      expect(equipPool.find(x => x.name === '十相全知').rank_type).toBe('5')
      expect(equipPool.find(x => x.name === '松雀（上）').rank_type).toBe('4')

      // Wiki cache must be written on disk
      expect(await fs.pathExists(path.join(tmpUserDataDir, 'bh3', 'wiki-rank-cache.json'))).toBe(true)

      // Re-fetching the exact same 30-day data must NOT duplicate identical 10-pull materials
      await fetchData(bh3Url, 'bh3')
      expect(getData('bh3').dataMap.get('210000123').result.get('bh3_char_a')).toHaveLength(11)
      expect(getData('bh3').dataMap.get('210000123').result.get('bh3_equip_a')).toHaveLength(2)

      // Excel export works cleanly for BH3
      const bh3ExcelBuf = await createWorkbookBuffer(bh3Data, 'bh3', i18n.forGame('bh3', 'zh-cn'))
      const bh3Wb = new ExcelJS.Workbook()
      await bh3Wb.xlsx.load(bh3ExcelBuf)
      expect(bh3Wb.getWorksheet('角色补给A').rowCount).toBe(12)
      expect(bh3Wb.getWorksheet('装备补给A').getRow(3).getCell(4).value).toBe('S级/5星')
      expect(bh3Wb.getWorksheet('rawData').rowCount).toBe(14)

      // Portable JSON export + round-trip import
      const portable = generatePortableGameJson('bh3', '210000123')
      expect(portable.info.format).toBe('hoyo-gacha-portable-v1')
      expect(portable.info.game).toBe('bh3')
      expect(portable.list).toHaveLength(13)
      const reimported = await importParsedJson(portable)
      expect(reimported).toEqual(['bh3'])
      expect(getData('bh3').dataMap.get('210000123').result.get('bh3_char_a')).toHaveLength(11)

      // HoYoGet-Plugin BH3 export import
      const hoyogetGames = await importParsedJson({
        game: 'bh3',
        uid: '210000999',
        pools: {
          协同补给: {
            records: [
              { time: '2026-11-11 10:00:00', content: '[协同者]松雀' }
            ]
          }
        }
      })
      expect(hoyogetGames).toEqual(['bh3'])
      const astralPool = getData('bh3').dataMap.get('210000999').result.get('bh3_astralop')
      expect(astralPool).toHaveLength(1)
      expect(astralPool[0].rank_type).toBe('5')

      // Strict UIGF v4.2 export must exclude BH3 and remain schema-valid
      const uigf42All = await generateUigf42Json()
      expect(validateUigf42(uigf42All)).toBe(true)
      expect('bh3' in uigf42All).toBe(false)
    } finally {
      bh3Adapter.getApiDomain = origGetApiDomain
      bh3Adapter.defaultApiDomain = origDefaultDomain
      bh3Adapter.getWikiChannelUrl = origGetWikiChannelUrl
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('HSR BlindBox (starrail_blindbox) end-to-end mock HTTP fetch: max_id pagination, HSR UID fallback, sub-rarity mapping, Excel & portable JSON', async () => {
    const http = require('http')
    const blindboxAdapter = getGameAdapter('starrail_blindbox')
    const origGetApiDomain = blindboxAdapter.getApiDomain
    const origDefaultDomain = blindboxAdapter.defaultApiDomain

    const requestedUrls = []
    const page1Items = [
      { id: '1790000000000000005', pool_id: '1001', item_id: '5001', item_name: '稀有猫猫狸·星', pet_id: '101', chroma_appearance_id: '1', pet_type: '2', blind_box_sub_rarity: '52', type_name: '猫猫狸', time: '2026-10-05 12:00:05' },
      { id: '1790000000000000004', pool_id: '1001', item_id: '4001', item_name: '经典猫猫狸', pet_id: '102', chroma_appearance_id: '0', pet_type: '2', blind_box_sub_rarity: '41', type_name: '猫猫狸', time: '2026-10-05 12:00:04' }
    ]
    const page2Items = [
      { id: '1790000000000000001', pool_id: '1001', item_id: '3001', item_name: '普通奇美拉', pet_id: '103', chroma_appearance_id: '0', pet_type: '1', blind_box_sub_rarity: '31', type_name: '奇美拉', time: '2026-10-05 12:00:01' }
    ]

    const server = http.createServer((req, res) => {
      requestedUrls.push(req.url)
      res.setHeader('Content-Type', 'application/json')
      if (req.url.includes('getBlindBoxLog')) {
        if (req.url.includes('max_id=0')) {
          res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { region: 'prod_gf_cn', region_time_zone: 8, list: page1Items } }))
          return
        }
        if (req.url.includes('max_id=1790000000000000004')) {
          res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { region: 'prod_gf_cn', region_time_zone: 8, list: page2Items } }))
          return
        }
        res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { region: 'prod_gf_cn', region_time_zone: 8, list: [] } }))
        return
      }
      if (req.url.includes('getGachaLog') && req.url.includes('gacha_type=11')) {
        res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list: [{ uid: '100888777' }] } }))
        return
      }
      res.end(JSON.stringify({ retcode: 0, message: 'OK', data: { list: [] } }))
    })

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address()
    const mockDomain = `http://127.0.0.1:${port}`

    try {
      blindboxAdapter.getApiDomain = () => mockDomain
      blindboxAdapter.defaultApiDomain = mockDomain

      // Verify URL regexes for BlindBox primary + HSR fallback
      const bbPrimary = 'https://act.mihoyo.com/sr/event/e20260928wishrate-q3jkjt/index.html?auth_appid=webview_gacha&authkey=bb_key&game_biz=hkrpg_cn&lang=zh-cn'
      expect(bbPrimary.match(blindboxAdapter.urlRegex)).toEqual([bbPrimary])
      const hsrFallback = 'https://webstatic.mihoyo.com/hkrpg/event/e20211215gacha-v2/index.html?auth_appid=webview_gacha&authkey=hsr_key&game_biz=hkrpg_cn'
      expect(hsrFallback.match(blindboxAdapter.fallbackUrlRegex)).toEqual([hsrFallback])

      await fetchData(`${mockDomain}/sr/event/e20260928wishrate-q3jkjt/index.html?auth_appid=webview_gacha&authkey=bb_key&game_biz=hkrpg_cn&lang=zh-cn`, 'starrail_blindbox')

      expect(requestedUrls.some(u => u.includes('getBlindBoxLog') && u.includes('size=5') && u.includes('max_id=1790000000000000004'))).toBe(true)
      expect(requestedUrls.some(u => u.includes('getGachaLog') && u.includes('gacha_type=11'))).toBe(true)

      const bbData = getData('starrail_blindbox').dataMap.get('100888777')
      expect(bbData).toBeDefined()
      const pool = bbData.result.get('1001')
      expect(pool).toHaveLength(3)
      expect(pool.map(x => x.rank_type)).toEqual(['3', '4', '5'])
      expect(pool[2].blind_box_sub_rarity).toBe('52')

      // Excel export with sub-rarity remark
      const bbBuf = await createWorkbookBuffer(bbData, 'starrail_blindbox', i18n.forGame('starrail_blindbox', 'zh-cn'))
      const bbWb = new ExcelJS.Workbook()
      await bbWb.xlsx.load(bbBuf)
      const sheet = bbWb.getWorksheet('星际潮玩')
      expect(sheet.getRow(4).getCell(4).value).toBe(5)
      expect(sheet.getRow(4).getCell(6).value).toBe(3)
      expect(sheet.getRow(4).getCell(7).value).toBe('隐藏款·稀有猫猫狸')

      // Portable JSON round-trip
      const portable = generatePortableGameJson('starrail_blindbox', '100888777')
      expect(portable.info.portable_key).toBe('hkrpg_blindbox')
      expect(await importParsedJson(portable)).toEqual(['starrail_blindbox'])
    } finally {
      blindboxAdapter.getApiDomain = origGetApiDomain
      blindboxAdapter.defaultApiDomain = origDefaultDomain
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('pending PC games reject live fetch honestly without HTTP calls, while supporting portable JSON, Excel, and renderer stats', async () => {
    for (const pendingId of PENDING_GAME_IDS) {
      expect(await getUrl(pendingId)).toBe(false)
      expect(getQuerystring('https://example.com?authkey=fake', pendingId)).toBe(false)
      await expect(fetchData('https://example.com?authkey=fake', pendingId)).rejects.toThrow()
    }

    // Import portable JSON for Petit Planet
    const hygImported = await importParsedJson({
      info: {
        format: 'hoyo-gacha-portable-v1',
        game: 'petitplanet',
        uid: '700001',
        lang: 'zh-cn',
        region_time_zone: 8
      },
      list: [
        { id: '1', gacha_type: 'hyg_event', time: '2026-12-05 12:00:00', name: '星光花盆', item_type: '家具', rank_type: '4' },
        { id: '2', gacha_type: 'hyg_event', time: '2026-12-05 12:00:05', name: '流星树屋', item_type: '套装', rank_type: '5' }
      ]
    })
    expect(hygImported).toEqual(['petitplanet'])
    const hygData = getData('petitplanet').dataMap.get('700001')
    expect(hygData.result.get('hyg_event')).toHaveLength(2)

    const hygExcel = await createWorkbookBuffer(hygData, 'petitplanet', i18n.forGame('petitplanet', 'zh-cn'))
    const hygWb = new ExcelJS.Workbook()
    await hygWb.xlsx.load(hygExcel)
    expect(hygWb.getWorksheet('活动卡池').getRow(3).getCell(6).value).toBe(2)

    const hygExported = generatePortableGameJson('petitplanet', '700001')
    expect(hygExported.info.portable_key).toBe('hyg')
    expect(hygExported.list).toHaveLength(2)

    // Renderer gachaDetail stats for BH3, Starrail BlindBox, and Petit Planet
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

    const bh3Stats = gachaDetail(new Map([
      ['bh3_char_a', [
        { time: '2026-11-10 20:00:00', name: '金币*50000', item_type: '材料', rank_type: '3' },
        { time: '2026-11-10 20:00:01', name: '松雀·欺世之影', item_type: '角色', rank_type: '5' },
        { time: '2026-11-10 20:00:02', name: '女武神·巡矢', item_type: '角色', rank_type: '4' }
      ]]
    ]), 'bh3')
    expect(bh3Stats.get('bh3_char_a').count5).toBe(1)
    expect(bh3Stats.get('bh3_char_a').count4).toBe(1)
    expect(bh3Stats.get('bh3_char_a').count3).toBe(1)
    expect(bh3Stats.get('bh3_char_a').countMio).toBe(1)
    expect(bh3Stats.get('bh3_char_a').ssrPos[0]).toEqual(['松雀·欺世之影', 2, '2026-11-10 20:00:01', '角色'])

    const bbStats = gachaDetail(new Map([
      ['1001', [
        { time: '2026-10-05 12:00:01', item_name: '普通奇美拉', item_type: '奇美拉', rank_type: '3', blind_box_sub_rarity: '31' },
        { time: '2026-10-05 12:00:05', item_name: '稀有猫猫狸·星', item_type: '猫猫狸', rank_type: '5', blind_box_sub_rarity: '52' }
      ]]
    ]), 'starrail_blindbox')
    expect(bbStats.get('1001').count5).toBe(1)
    expect(bbStats.get('1001').ssrPos[0]).toEqual(['稀有猫猫狸·星', 2, '2026-10-05 12:00:05', '52'])

    const hygStats = gachaDetail(hygData.result, 'petitplanet')
    expect(hygStats.get('hyg_event').count5).toBe(1)
    expect(hygStats.get('hyg_event').count4).toBe(1)
    expect(hygStats.get('hyg_event').countMio).toBe(0)
  })

  test('getCacheText scans direct and versioned webCaches folders and returns the newest data_2 file', async () => {
    const fakeGameDir = path.join(tmpUserDataDir, 'fake-game-cache')
    const legacyCache = path.join(fakeGameDir, 'webCaches', 'Cache', 'Cache_Data', 'data_2')
    const versionedCache = path.join(fakeGameDir, 'webCaches', '2.35.0.0', 'Cache', 'Cache_Data', 'data_2')

    expect(await utils.getCacheText(fakeGameDir)).toEqual(['', ''])

    await fs.outputFile(legacyCache, '1/0/https://example.com/old?authkey=old\x00')
    await fs.outputFile(versionedCache, '1/0/https://example.com/new?authkey=new\x00')
    const olderTime = new Date(Date.now() - 60_000)
    const newerTime = new Date()
    await fs.utimes(legacyCache, olderTime, olderTime)
    await fs.utimes(versionedCache, newerTime, newerTime)

    const [text, matchedPath] = await utils.getCacheText(fakeGameDir)
    expect(matchedPath).toBe(versionedCache)
    expect(text).toContain('https://example.com/new?authkey=new')
  })
})
