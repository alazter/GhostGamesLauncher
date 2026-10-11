export const FEATURED_INTERVAL_MS = 7000

export interface FeaturedSelection {
  ids: string[]
  remaining: string[]
  knownIds: string[]
  index: number
}

export const emptyFeaturedSelection = (): FeaturedSelection => ({
  ids: [],
  remaining: [],
  knownIds: [],
  index: 0
})

function shuffle(ids: string[], random: () => number) {
  const result = [...ids]
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

/** Draw without replacement, refilling the shuffled queue only when exhausted. */
export function nextFeaturedSelection(
  availableIds: string[],
  previous = emptyFeaturedSelection(),
  random = Math.random
): FeaturedSelection {
  const available = [...new Set(availableIds)]
  const valid = new Set(available)
  const recent = new Set(previous.ids)
  const known = new Set(previous.knownIds)
  let remaining = previous.remaining.filter((id) => valid.has(id))
  remaining.push(
    ...shuffle(
      available.filter((id) => !known.has(id)),
      random
    )
  )
  const ids: string[] = []

  while (ids.length < Math.min(3, available.length)) {
    if (remaining.length === 0) {
      const eligible = available.filter((id) => !ids.includes(id))
      // Avoid the previous group when a new pass through the library begins.
      remaining = [
        ...shuffle(
          eligible.filter((id) => !recent.has(id)),
          random
        ),
        ...shuffle(
          eligible.filter((id) => recent.has(id)),
          random
        )
      ]
    }
    const id = remaining.shift()!
    if (!ids.includes(id)) ids.push(id)
  }

  // With small libraries, don't show the same title on consecutive slides.
  if (ids.length > 1 && ids[0] === previous.ids[previous.index]) {
    ;[ids[0], ids[1]] = [ids[1], ids[0]]
  }
  return { ids, remaining, knownIds: available, index: 0 }
}
