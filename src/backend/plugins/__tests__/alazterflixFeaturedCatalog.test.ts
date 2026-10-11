import {
  emptyFeaturedSelection,
  nextFeaturedSelection
} from '../../../frontend/screens/Alazterflix/featuredCatalog'

describe('Alazterflix random featured titles', () => {
  test.each([0, 1, 2, 3])(
    'handles a library with %i distinct titles',
    (count) => {
      const available = Array.from(
        { length: count },
        (_, index) => `title-${index}`
      )
      let selection = emptyFeaturedSelection()
      for (let cycle = 0; cycle < 5; cycle++) {
        const last = selection.ids[selection.index]
        selection = nextFeaturedSelection(available, selection, () => 0)
        expect(selection.ids).toHaveLength(count)
        expect(new Set(selection.ids).size).toBe(count)
        if (count > 1) expect(selection.ids[0]).not.toBe(last)
        selection = { ...selection, index: Math.max(0, count - 1) }
      }
    }
  )

  test('visits every title before repeating and renews all three suggestions', () => {
    const available = Array.from({ length: 12 }, (_, index) => `title-${index}`)
    let selection = emptyFeaturedSelection()
    const seen: string[] = []
    for (let cycle = 0; cycle < 4; cycle++) {
      const previous = selection
      selection = nextFeaturedSelection(available, previous, () => 0.25)
      expect(selection.ids.some((id) => previous.ids.includes(id))).toBe(false)
      seen.push(...selection.ids)
      selection.index = 2
    }
    expect(new Set(seen).size).toBe(12)
    const renewed = nextFeaturedSelection(available, selection, () => 0.25)
    expect(renewed.ids.some((id) => selection.ids.includes(id))).toBe(false)
  })

  test('exhausts an incomplete batch before refilling and never duplicates a slot', () => {
    const available = Array.from({ length: 7 }, (_, index) => `title-${index}`)
    let selection = emptyFeaturedSelection()
    const seen: string[] = []
    for (let cycle = 0; cycle < 3; cycle++) {
      selection = nextFeaturedSelection(available, selection, () => 0.9)
      expect(new Set(selection.ids).size).toBe(3)
      seen.push(...selection.ids)
      selection.index = 2
    }
    expect(new Set(seen.slice(0, 7)).size).toBe(7)
  })

  test('removes deleted titles, includes new titles and preserves input arrays', () => {
    const available = ['a', 'b', 'c', 'd', 'e', 'f']
    const previous = nextFeaturedSelection(available, undefined, () => 0.2)
    const before = JSON.stringify(previous)
    const updated = nextFeaturedSelection(
      ['new', 'a', 'a'],
      previous,
      () => 0.2
    )
    expect(new Set(updated.ids)).toEqual(new Set(['new', 'a']))
    expect(updated.remaining).toEqual([])
    expect(JSON.stringify(previous)).toBe(before)
    expect(available).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  test('uses randomness rather than the catalog order or ratings', () => {
    const available = ['a', 'b', 'c', 'd', 'e', 'f']
    const first = nextFeaturedSelection(available, undefined, () => 0)
    const second = nextFeaturedSelection(available, undefined, () => 0.99)
    expect(first.ids).not.toEqual(second.ids)
  })
})
