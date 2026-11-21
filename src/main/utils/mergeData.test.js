const { mergeList, mergeData, mergeMultisetList, getRecordId } = require('./mergeData')

describe('mergeData / mergeList', () => {
  test('merges Star Rail / ZZZ object records chronologically and deduplicates by BigInt id', () => {
    const listA = [
      { id: '1682521800010412850', time: '2024-01-01 10:00:00', name: 'A' },
      { id: '1682521800010412950', time: '2024-01-01 10:02:00', name: 'C' }
    ]
    const listB = [
      { id: '1682521800010412900', time: '2024-01-01 10:01:00', name: 'B' },
      { id: '1682521800010412950', time: '2024-01-01 10:02:00', name: 'C' }
    ]

    expect(mergeList(listA, listB).map(x => x.id)).toEqual([
      '1682521800010412850',
      '1682521800010412900',
      '1682521800010412950'
    ])
  })

  test('handles empty lists safely', () => {
    const item = [{ id: '1682521800010412900' }]
    expect(mergeList([], item)).toEqual(item)
    expect(mergeList(item, [])).toEqual(item)
  })

  test('merges Genshin tuple records with IDs and falls back to overlap matching when legacy items lack IDs', () => {
    const legacyA = [
      ['2021-01-01 12:00:00', '铁影阔剑', '武器', 3, '301'],
      ['2021-01-01 12:00:05', '刻晴', '角色', 5, '301'],
      ['2021-01-01 12:00:10', '芭芭拉', '角色', 4, '301']
    ]
    const newB = [
      ['2021-01-01 12:00:05', '刻晴', '角色', 5, '301', '1610000000000000002'],
      ['2021-01-01 12:00:10', '芭芭拉', '角色', 4, '301', '1610000000000000003'],
      ['2021-01-01 12:00:20', '迪卢克', '角色', 5, '301', '1610000000000000004']
    ]

    const merged = mergeList(legacyA, newB)
    expect(merged).toHaveLength(4)
    expect(merged.map(x => x[1])).toEqual(['铁影阔剑', '刻晴', '芭芭拉', '迪卢克'])
    expect(getRecordId(merged[3])).toBe('1610000000000000004')
  })

  test('mergeData preserves local pools missing in partial updates for same UID', () => {
    const local = {
      uid: '10001',
      result: new Map([
        ['100', [['2021-01-01 00:00:00', '诺艾尔', '角色', 4, '100', '1']]],
        ['301', [['2021-01-02 00:00:00', '温迪', '角色', 5, '301', '2']]]
      ])
    }
    const origin = {
      uid: 10001,
      result: new Map([
        ['301', [['2021-01-03 00:00:00', '可莉', '角色', 5, '301', '3']]]
      ])
    }

    const merged = mergeData(local, origin)
    expect(merged.get('100')).toHaveLength(1)
    expect(merged.get('301').map(x => x[1])).toEqual(['温迪', '可莉'])
  })

  test('mergeMultisetList preserves identical same-second 10-pull items without duplicating on re-fetch', () => {
    const pull1 = [
      { time: '2026-10-01 12:00:00', name: '金币*50000', item_type: '材料', rank_type: '3', raw_content: '[材料]金币*50000' },
      { time: '2026-10-01 12:00:00', name: '金币*50000', item_type: '材料', rank_type: '3', raw_content: '[材料]金币*50000' },
      { time: '2026-10-01 12:00:00', name: '金币*50000', item_type: '材料', rank_type: '3', raw_content: '[材料]金币*50000' },
      { time: '2026-10-01 12:00:00', name: '松雀·欺世之影', item_type: '角色', rank_type: '4', raw_content: '[角色]松雀·欺世之影角色卡' }
    ]

    const firstSave = mergeMultisetList([], pull1, 'bh3_char_a')
    expect(firstSave).toHaveLength(4)
    expect(firstSave.every(item => /^\d+$/.test(item.id))).toBe(true)
    expect(new Set(firstSave.map(item => item.id)).size).toBe(4)

    // Re-fetching the exact same 10-pull (with refreshed S-rank wiki lookup) must not duplicate items
    const refreshWithNewPull = [
      ...pull1.slice(0, 3),
      { time: '2026-10-01 12:00:00', name: '松雀·欺世之影', item_type: '角色', rank_type: '5', raw_content: '[角色]松雀·欺世之影角色卡' },
      { time: '2026-10-01 12:05:00', name: '金币*50000', item_type: '材料', rank_type: '3', raw_content: '[材料]金币*50000' },
      { time: '2026-10-01 12:05:00', name: '金币*50000', item_type: '材料', rank_type: '3', raw_content: '[材料]金币*50000' }
    ]

    const merged = mergeData(
      { uid: '123456', result: new Map([['bh3_char_a', firstSave]]) },
      { uid: '123456', result: new Map([['bh3_char_a', refreshWithNewPull]]) },
      { multiset: true }
    )

    const mergedPool = merged.get('bh3_char_a')
    expect(mergedPool).toHaveLength(6)
    expect(mergedPool.filter(x => x.time === '2026-10-01 12:00:00' && x.name === '金币*50000')).toHaveLength(3)
    expect(mergedPool.filter(x => x.time === '2026-10-01 12:05:00' && x.name === '金币*50000')).toHaveLength(2)
    expect(mergedPool.find(x => x.name === '松雀·欺世之影').rank_type).toBe('5')
  })
})
