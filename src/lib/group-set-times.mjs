export function groupSetTimes(setTimes = []) {
  const staged = setTimes.some((set) => set?.stage)
  if (!staged) return [{ name: null, order: null, sets: [...setTimes] }]

  const groups = new Map()
  for (const set of setTimes) {
    const name = String(set?.stage ?? '').trim()
    if (!name) throw new Error('partially_staged_set_times')
    const order = Number.isFinite(Number(set.stageOrder)) ? Number(set.stageOrder) : Number.MAX_SAFE_INTEGER
    const key = `${order}:${name}`
    if (!groups.has(key)) groups.set(key, { name, order, sets: [] })
    groups.get(key).sets.push(set)
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    .map((group) => ({
      ...group,
      sets: group.sets.sort((left, right) =>
        left.startsAtUtc.localeCompare(right.startsAtUtc) || left.name.localeCompare(right.name)),
    }))
}
