import { mkdir, mkdtemp, readFile, writeFile, rm } from 'fs/promises'
import { resolve, join } from 'path'
import { ReleaseArchive, validateReleaseArchive } from '../archive'
import {
  releaseUpdateProblem,
  catalogUpdateProblem
} from 'common/releaseValidation'
import { parseReleaseProduct } from '../parser'
import type { ReleaseProduct, ReleaseCatalog } from 'common/types/releases'

const product: ReleaseProduct = {
  id: 'example',
  title: 'Example',
  url: 'https://www.releases.com/p/example',
  category: 'games',
  region: 'us',
  platforms: ['PC'],
  dateLabel: 'Oct 3, 2026',
  releaseDate: '2026-10-03',
  releases: [
    {
      platform: 'PC',
      region: 'us',
      dateLabel: 'Oct 3, 2026',
      date: '2026-10-03',
      estimated: false
    }
  ],
  images: [],
  videos: [],
  tags: []
}
let directory: string
const testRoot = resolve('build/release-archive-tests')
beforeEach(async () => {
  await mkdir(testRoot, { recursive: true })
  directory = await mkdtemp(join(testRoot, 'archive-'))
})
afterEach(async () => {
  if (!resolve(directory).startsWith(testRoot + require('path').sep))
    throw new Error('Unsafe test path')
  await rm(directory, { recursive: true, force: true })
})

it('persists validated products across process/store instances and includes bounded history in backups', async () => {
  const archive = new ReleaseArchive(directory)
  for (const title of ['A', 'B', 'C', 'D'])
    await archive.put('product', 'us:example', { ...product, title })
  const reopened = new ReleaseArchive(directory)
  expect(
    (await reopened.get<ReleaseProduct>('product', 'us:example'))?.value.title
  ).toBe('D')
  const backup = await reopened.export()
  expect(
    backup.records[0].revisions.map(
      (item) => (item.value as ReleaseProduct).title
    )
  ).toEqual(['D', 'C', 'B'])
  expect(validateReleaseArchive(backup)).toEqual(backup)
})

it('recovers the previous file after corruption without erasing both copies', async () => {
  const archive = new ReleaseArchive(directory)
  await archive.put('product', 'us:example', product)
  await writeFile(join(directory, 'archive.json'), '{broken')
  expect(
    (
      await new ReleaseArchive(directory).get<ReleaseProduct>(
        'product',
        'us:example'
      )
    )?.value.title
  ).toBe('Example')
  await writeFile(join(directory, 'archive.previous.json'), '{also-broken')
  await expect(archive.put('product', 'us:example', product)).rejects.toThrow(
    'originais'
  )
  expect(await readFile(join(directory, 'archive.json'), 'utf8')).toBe(
    '{broken'
  )
})

it('serializes concurrent saves and merges a backup without removing unrelated products', async () => {
  const archive = new ReleaseArchive(directory)
  await Promise.all(
    ['a', 'b', 'c'].map((id) =>
      archive.put('product', `us:${id}`, {
        ...product,
        id,
        url: `https://www.releases.com/p/${id}`
      })
    )
  )
  const backup = await archive.export()
  await archive.put('product', 'us:example', product)
  await archive.merge(backup)
  expect((await archive.export()).records).toHaveLength(4)
  await expect(archive.merge({ version: 2, records: [] })).rejects.toThrow()
})

it('rejects invalid snapshots before they can enter the archive', async () => {
  const archive = new ReleaseArchive(directory)
  await archive.put('product', 'us:example', product)
  await expect(
    archive.put('product', 'us:example', {
      ...product,
      releaseDate: '2026-02-31'
    })
  ).rejects.toThrow()
  expect(
    (await archive.get<ReleaseProduct>('product', 'us:example'))?.value
  ).toEqual(product)
})

it('keeps the newest confirmation when restoring an older duplicate snapshot', async () => {
  const archive = new ReleaseArchive(directory)
  await archive.put('product', 'us:example', product)
  const old = await archive.export()
  old.records[0].revisions[0].at = 1
  const before = await archive.get('product', 'us:example')
  await archive.merge(old)
  expect(await archive.get('product', 'us:example')).toEqual(before)
})

it('blocks disappearing dates, fields and regions but accepts explicit postponement to TBA', () => {
  expect(
    releaseUpdateProblem({ ...product, releases: [] }, product)
  ).toBeDefined()
  expect(
    releaseUpdateProblem({ ...product, region: 'uk' }, product)
  ).toBeDefined()
  expect(
    releaseUpdateProblem(
      { ...product, releases: [{ ...product.releases[0], dateLabel: '' }] },
      product
    )
  ).toBeDefined()
  expect(
    releaseUpdateProblem(
      {
        ...product,
        releaseDate: undefined,
        releases: [
          {
            ...product.releases[0],
            date: undefined,
            dateLabel: 'TBA',
            estimated: true
          }
        ]
      },
      product
    )
  ).toBeUndefined()
  expect(() =>
    parseReleaseProduct(
      '<h1 class="RWP-Product-MainInfoView-Name">Example</h1><div class="RWP-Product-ReleaseInfoView-DateListItem"><b class="RWP-Product-ReleaseInfoView-Item">PC</b><span class="RWP-Product-ReleaseInfoView-ItemReleaseDate">Oct 3, 2026</span></div>',
      'example',
      'uk'
    )
  ).toThrow('região')
})

it('quarantines a suspicious empty catalog instead of replacing a populated one', () => {
  const catalog: ReleaseCatalog = {
    products: [product],
    filters: [],
    hasMore: false,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'https://www.releases.com/calendar',
    stale: false
  }
  expect(catalogUpdateProblem({ ...catalog, products: [] }, catalog)).toContain(
    'suspensa'
  )
  expect(catalogUpdateProblem({ ...catalog, products: [] })).toBeUndefined()
})
