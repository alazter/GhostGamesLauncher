import http from 'node:http'
import fs from 'graceful-fs'
import os from 'node:os'
import path from 'node:path'
import { MediaStreamServer } from '../mediaStreamServer'

describe('local video stream continuity', () => {
  let directory: string
  let url: string
  const size = 20 * 1024 * 1024 + 37
  beforeAll(async () => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'ghost-stream-continuity-')
    )
    const file = path.join(directory, 'synthetic.mp4')
    fs.writeFileSync(file, Buffer.alloc(size, 91))
    url = await MediaStreamServer.getInstance().getStreamUrl(file)
  })
  afterAll(() => {
    MediaStreamServer.getInstance().stop()
    fs.rmSync(directory, { recursive: true, force: true })
  })

  const request = (range?: string, method = 'GET') =>
    new Promise<{
      status: number
      headers: http.IncomingHttpHeaders
      bytes: number
    }>((resolve, reject) => {
      const req = http.request(
        url,
        { method, headers: range ? { Range: range } : {} },
        (res) => {
          let bytes = 0
          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length
          })
          res.on('error', reject)
          res.on('end', () =>
            resolve({ status: res.statusCode!, headers: res.headers, bytes })
          )
        }
      )
      req.on('error', reject)
      req.end()
    })

  test('an open range streams to EOF past the old 16 MiB cutoff', async () => {
    const response = await request('bytes=0-')
    expect(response.status).toBe(206)
    expect(response.headers['content-range']).toBe(
      `bytes 0-${size - 1}/${size}`
    )
    expect(response.bytes).toBe(size)
  })
  test('a later open range continues through the remainder of the file', async () => {
    const response = await request('bytes=1024-')
    expect(response.headers['content-length']).toBe(String(size - 1024))
    expect(response.bytes).toBe(size - 1024)
  })
  test('bounded and suffix ranges retain native seek support', async () => {
    expect((await request('bytes=10-29')).bytes).toBe(20)
    const suffix = await request('bytes=-200')
    expect(suffix.status).toBe(206)
    expect(suffix.bytes).toBe(200)
    expect(suffix.headers['content-range']).toBe(
      `bytes ${size - 200}-${size - 1}/${size}`
    )
    const clamped = await request(`bytes=${size - 10}-${size + 100}`)
    expect(clamped.headers['content-length']).toBe('10')
    expect(clamped.bytes).toBe(10)
  })
  test.each([
    'bytes=99-10',
    'bytes=-0',
    'bytes=abc-',
    'bytes=9007199254740992-',
    'bytes=0-1,4-5'
  ])('rejects an invalid range %s', async (range) => {
    const response = await request(range)
    expect(response.status).toBe(416)
    expect(response.headers['content-range']).toBe(`bytes */${size}`)
  })
  test('HEAD returns matching headers without a response body', async () => {
    const response = await request('bytes=0-', 'HEAD')
    expect(response.status).toBe(200)
    expect(response.headers['content-length']).toBe(String(size))
    expect(response.bytes).toBe(0)
  })
})
