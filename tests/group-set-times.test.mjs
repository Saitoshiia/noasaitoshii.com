import assert from 'node:assert/strict'
import test from 'node:test'

import { groupSetTimes } from '../src/lib/group-set-times.mjs'

test('groups simultaneous sets by stage order without treating time as identity', () => {
  const groups = groupSetTimes([
    { name: 'Billy Horn', stage: 'The Gallery', stageOrder: 2, startsAtUtc: '2026-07-26T04:30:00Z' },
    { name: 'Petirwyn B2B Noa Saitoshii', stage: 'Main Room', stageOrder: 1, startsAtUtc: '2026-07-26T04:30:00Z' },
    { name: 'Daxson', stage: 'Main Room', stageOrder: 1, startsAtUtc: '2026-07-26T07:00:00Z' },
  ])

  assert.deepEqual(groups.map((group) => group.name), ['Main Room', 'The Gallery'])
  assert.deepEqual(groups[0].sets.map((set) => set.name), ['Petirwyn B2B Noa Saitoshii', 'Daxson'])
  assert.deepEqual(groups[1].sets.map((set) => set.name), ['Billy Horn'])
})

test('preserves the single-stage presentation for unstaged events', () => {
  const sets = [{ name: 'Noa', startsAtUtc: '2026-07-26T04:30:00Z' }]
  assert.deepEqual(groupSetTimes(sets), [{ name: null, order: null, sets }])
})

test('fails closed when only part of a lineup has a stage', () => {
  assert.throws(
    () => groupSetTimes([
      { name: 'Noa', stage: 'Main Room', stageOrder: 1, startsAtUtc: '2026-07-26T04:30:00Z' },
      { name: 'Unassigned', startsAtUtc: '2026-07-26T05:30:00Z' },
    ]),
    /partially_staged_set_times/,
  )
})
