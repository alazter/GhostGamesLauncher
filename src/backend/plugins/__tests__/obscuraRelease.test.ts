jest.mock('../engineProcess', () => ({ engineProcess: jest.fn() }))
import {
  officialObscuraRelease,
  testObscuraCompatibility
} from '../obscuraRelease'
import { engineProcess } from '../engineProcess'

const url =
  'https://github.com/h4ckf0r0day/obscura/releases/download/v0.2.5/obscura-x86_64-windows.zip'
const metadata = {
  tag_name: 'v0.2.5',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'obscura-x86_64-windows.zip',
      browser_download_url: url,
      size: 1024,
      digest: `sha256:${'a'.repeat(64)}`
    }
  ]
}
it('selects the official stable Windows x64 asset and its GitHub SHA-256', () => {
  expect(
    officialObscuraRelease(metadata, '0.3.7-beta', 'win32', 'x64')
  ).toMatchObject({
    id: 'obscura',
    version: '0.2.5',
    executable: 'obscura.exe',
    sha256: 'a'.repeat(64),
    url
  })
})
it.each([
  { draft: true },
  { prerelease: true },
  { tag_name: 'v0.3.0-beta.1' },
  { tag_name: '../payload' },
  { assets: [] },
  { assets: [{ ...metadata.assets[0], digest: null }] },
  {
    assets: [
      {
        ...metadata.assets[0],
        browser_download_url: 'https://evil.test/payload.zip'
      }
    ]
  },
  { assets: [{ ...metadata.assets[0], size: 251 * 1024 * 1024 }] },
  {
    assets: [
      { ...metadata.assets[0], name: 'obscura-x86_64-windows-stealth.zip' }
    ]
  }
])('refuses incomplete or untrusted release metadata %j', (change) => {
  expect(
    officialObscuraRelease(
      { ...metadata, ...change },
      '0.3.7-beta',
      'win32',
      'x64'
    )
  ).toBeUndefined()
})
it('does not offer a Windows executable on a different platform or architecture', () => {
  expect(
    officialObscuraRelease(metadata, '0.3.7-beta', 'linux', 'x64')
  ).toBeUndefined()
  expect(
    officialObscuraRelease(metadata, '0.3.7-beta', 'win32', 'arm64')
  ).toBeUndefined()
})
it('checks the real fetch arguments and a JavaScript-created DOM value in an isolated local page', async () => {
  jest.mocked(engineProcess).mockImplementation(async (_exe, args) => {
    const response = await fetch(args[1])
    const html = await response.text()
    const suffix = html.match(/GHOST_ENGINE_'\+'([a-f0-9]+)'/)?.[1]
    expect(suffix).toBeTruthy()
    return `GHOST_ENGINE_${suffix}`
  })
  await testObscuraCompatibility('obscura.exe')
  expect(engineProcess).toHaveBeenCalledWith(
    'obscura.exe',
    [
      'fetch',
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/compatibility$/),
      '--allow-private-network',
      '--timeout',
      '10',
      '--dump',
      'html'
    ],
    undefined,
    20000
  )
})
it('rejects a worker that cannot execute JavaScript and render the expected DOM', async () => {
  jest.mocked(engineProcess).mockResolvedValue('<html>not rendered</html>')
  await expect(testObscuraCompatibility('obscura.exe')).rejects.toThrow(
    'compatibilidade'
  )
})
