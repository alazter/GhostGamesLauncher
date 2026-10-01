import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { rangedDownload } from '../rangedDownload'

const total = 32 * 1024 * 1024
const etag = '"fixture"'
let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ghost-ranges-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function response(headers: Record<string, string>, corrupt = false) {
  const [, a, b] = /^bytes=(\d+)-(\d+)$/.exec(headers.Range)!
  const start = Number(a),
    end = Number(b)
  const bytes = Buffer.alloc(
    end - start + 1,
    Math.floor(start / (8 * 1024 * 1024))
  )
  return new Response(bytes, {
    status: 206,
    headers: {
      'content-range': `bytes ${start}-${end}/${total}`,
      etag: corrupt ? '"changed"' : etag
    }
  })
}
function options(
  fetch: (
    headers: Record<string, string>,
    signal: AbortSignal
  ) => Promise<Response>
) {
  return {
    destination: join(root, 'package.zip'),
    total,
    etag,
    signal: new AbortController().signal,
    fetch,
    progress: jest.fn(),
    event: jest.fn()
  }
}

it('writes concurrent ranges in the right order without duplicating the package', async () => {
  let active = 0,
    maxActive = 0
  const args = options(async (headers) => {
    active++
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active--
    expect(headers['If-Range']).toBe(etag)
    return response(headers)
  })
  args.event.mockImplementation(() => { throw new Error('Diagnostic sink unavailable') })
  expect(await rangedDownload(args)).toBe(true)
  const bytes = await readFile(args.destination)
  expect(bytes.length).toBe(total)
  for (let part = 0; part < 4; part++) {
    expect(
      bytes
        .subarray((part * total) / 4, ((part + 1) * total) / 4)
        .equals(Buffer.alloc(total / 4, part))
    ).toBe(true)
  }
  expect(maxActive).toBe(4)
  expect(args.progress).toHaveBeenLastCalledWith(total)
})

it('leaves the browser fallback untouched when a server ignores ranges', async () => {
  const args = options(async () => new Response('not a range'))
  expect(await rangedDownload(args)).toBe(false)
  expect(await readdir(root)).toEqual([])
})

it('retries an interrupted part and reduces concurrent requests', async () => {
  let failed = false
  const args = options(async (headers) => {
    if (headers.Range === `bytes=0-${total / 4 - 1}` && !failed) {
      failed = true
      throw new Error('connection reset')
    }
    return response(headers)
  })
  expect(await rangedDownload(args)).toBe(true)
  expect(args.event).toHaveBeenCalledWith('ranged-retry-single-connection')
  expect((await readFile(args.destination)).length).toBe(total)
})

it('rejects a changed file revision and removes the incomplete package', async () => {
  const args = options(async (headers) =>
    response(headers, headers.Range !== 'bytes=0-0')
  )
  await expect(rangedDownload(args)).rejects.toThrow()
  expect(await readdir(root)).toEqual([])
})

it('does not attempt segmentation without a strong file validator', async () => {
  const fetch = jest.fn()
  expect(await rangedDownload({ ...options(fetch), etag: 'W/"fixture"' })).toBe(
    false
  )
  expect(fetch).not.toHaveBeenCalled()
})

it('resumes a partial file without requesting its existing prefix again', async () => {
  const offset = total / 4
  const calls: string[] = []
  const args = options(async headers => { calls.push(headers.Range); return response(headers) })
  await writeFile(args.destination, Buffer.alloc(offset, 0))
  expect(await rangedDownload({ ...args, resumeFrom: offset })).toBe(true)
  expect(calls).not.toContain(`bytes=0-${offset - 1}`)
  const bytes = await readFile(args.destination)
  for (let part = 0; part < 4; part++) expect(bytes.subarray(part * offset, (part + 1) * offset).equals(Buffer.alloc(offset, part))).toBe(true)
})

it('truncates unfinished out-of-order parts and preserves the contiguous prefix on failure', async () => {
  const offset = total / 4
  const args = options(async headers => {
    if (headers.Range === `bytes=${2 * offset}-${3 * offset - 1}`) throw new Error('connection reset')
    return response(headers)
  })
  await writeFile(args.destination, Buffer.alloc(offset, 0))
  await expect(rangedDownload({ ...args, resumeFrom: offset })).rejects.toThrow()
  const bytes = await readFile(args.destination)
  expect(bytes.length).toBe(2 * offset)
  expect(bytes.subarray(0, offset).equals(Buffer.alloc(offset, 0))).toBe(true)
  expect(bytes.subarray(offset).equals(Buffer.alloc(offset, 1))).toBe(true)
})
