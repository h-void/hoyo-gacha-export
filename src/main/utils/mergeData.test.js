const { mergeList, mergeData, getRecordId } = require('./mergeData')

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
})
