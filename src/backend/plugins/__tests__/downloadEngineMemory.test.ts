import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  DownloadEngineMemory,
  enginePageKey,
  validEngineControl
} from '../downloadEngineMemory'

let root: string
let file: string
let memory: DownloadEngineMemory
const source = 'com.ghost.ankergames-source'
const page = 'https://ankergames.net/game/test?token=private'
const control = {
  tag: 'BUTTON' as const,
  label: 'obter pacote',
  id: 'get-file'
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ghost-engine-memory-'))
  file = join(root, 'memory.json')
  memory = new DownloadEngineMemory(file)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('shares generic defaults with new installations without copying sessions', () => {
  expect(memory.controls(source, page)).toEqual(
    expect.arrayContaining([expect.objectContaining({ label: 'download' })])
  )
  expect(memory.order(source, page)).toEqual(['scrapling', 'obscura'])
  expect(enginePageKey(source, page)).toEqual({
    source,
    origin: 'https://ankergames.net',
    route: '/game/*'
  })
})
it('remembers a validated engine across restart and forgets its preference after repeated misses', () => {
  memory.success(source, { engine: 'obscura', page, controls: [control] })
  memory = new DownloadEngineMemory(file)
  expect(memory.order(source, page)).toEqual(['obscura', 'scrapling'])
  memory.failure(source, page, 'obscura')
  expect(memory.order(source, page)[0]).toBe('obscura')
  memory.failure(source, page, 'obscura')
  expect(memory.order(source, page)[0]).toBe('scrapling')
  memory.manual(source, page, [
    { ...control, label: 'baixar arquivo', id: 'new-file' }
  ])
  expect(memory.controls(source, page)).toEqual([
    { ...control, label: 'baixar arquivo', id: 'new-file' }
  ])
  expect(memory.order(source, page)[0]).toBe('obscura')
})
it('stores only bounded semantic descriptors, without URLs, queries or extra values', () => {
  memory.success(source, {
    engine: 'scrapling',
    page,
    controls: [
      {
        ...control,
        id: 'secret123456',
        token: 'secret-token',
        html: 'secret-html'
      } as typeof control
    ]
  })
  const raw = readFileSync(file, 'utf8')
  for (const secret of ['private', 'token', 'secret', 'html', '/game/test'])
    expect(raw).not.toContain(secret)
  expect(memory.controls(source, page)).toEqual([
    { tag: 'BUTTON', label: 'obter pacote' }
  ])
})
it.each([
  'login',
  'confirmar captcha',
  'download premium',
  'delete file',
  'download https://private',
  'download?token=secret'
])('does not learn sensitive or unrelated controls: %s', (label) => {
  expect(validEngineControl({ ...control, label })).toBe(false)
})
it('does not accept form controls or corrupt/oversized persisted files', () => {
  expect(
    validEngineControl({
      ...control,
      form: { method: 'post', fields: ['password'] }
    })
  ).toBe(false)
  for (const raw of [
    'not json',
    JSON.stringify({ revision: 1, pages: [null, {}, { source }] }),
    'x'.repeat(128 * 1024 + 1)
  ]) {
    writeFileSync(file, raw)
    expect(memory.controls(source, page)).toHaveLength(2)
  }
})
