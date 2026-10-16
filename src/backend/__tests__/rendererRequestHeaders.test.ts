import type {
  Session,
  OnBeforeSendHeadersListenerDetails,
  BeforeSendResponse,
  WebRequestFilter
} from 'electron'
import {
  installRendererRequestHeaders,
  YOUTUBE_APP_REFERER
} from '../rendererRequestHeaders'

function setup(spoofWindows = false) {
  type HeaderListener = (
    details: OnBeforeSendHeadersListenerDetails,
    callback: (response: BeforeSendResponse) => void
  ) => void
  const onBeforeSendHeaders = jest.fn<
    void,
    [WebRequestFilter, HeaderListener]
  >()
  installRendererRequestHeaders(
    { webRequest: { onBeforeSendHeaders } } as unknown as Session,
    () => 7,
    spoofWindows
  )
  const [filter, listener] = onBeforeSendHeaders.mock.calls[0]
  const request = (
    overrides: Partial<OnBeforeSendHeadersListenerDetails> = {}
  ) => {
    const callback = jest.fn<void, [BeforeSendResponse]>()
    listener(
      {
        id: 1,
        method: 'GET',
        referrer: '',
        timestamp: 0,
        url: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=1',
        resourceType: 'subFrame',
        webContentsId: 7,
        requestHeaders: {},
        ...overrides
      },
      callback
    )
    expect(callback).toHaveBeenCalledTimes(1)
    return callback.mock.calls[0][0].requestHeaders
  }
  return { filter, request }
}

it('identifies embedded YouTube players from the local main renderer', () => {
  const { request, filter } = setup()
  expect(filter.urls).toHaveLength(3)
  for (const host of [
    'www.youtube-nocookie.com',
    'www.youtube.com',
    'youtube.com'
  ])
    expect(request({ url: `https://${host}/embed/M7lc1UVf-VE` })).toEqual({
      Referer: YOUTUBE_APP_REFERER
    })
})

it('preserves real web referers, authorization and other request headers', () => {
  const { request } = setup()
  const headers = {
    referer: 'http://localhost:5173/',
    Accept: 'text/html',
    Authorization: 'test-token'
  }
  expect(request({ requestHeaders: headers })).toEqual(headers)
  expect(
    request({
      requestHeaders: { rEfErEr: 'file:///app/index.html', Accept: 'text/html' }
    })
  ).toEqual({ Referer: YOUTUBE_APP_REFERER, Accept: 'text/html' })
})

it('does not alter accounts, other windows, providers, API calls or lookalike domains', () => {
  const { request } = setup()
  const scenarios: Partial<OnBeforeSendHeadersListenerDetails>[] = [
    { webContentsId: 8 },
    { webContentsId: undefined },
    { resourceType: 'mainFrame' },
    { resourceType: 'xhr' },
    { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE' },
    { url: 'https://www.youtube.com/youtubei/v1/player' },
    { url: 'https://player.vimeo.com/video/123456' },
    { url: 'https://www.youtube.com.evil.test/embed/M7lc1UVf-VE' },
    { url: 'http://www.youtube.com/embed/M7lc1UVf-VE' },
    { url: 'https://www.youtube.com/embed/invalid' }
  ]
  for (const overrides of scenarios) expect(request(overrides)).toEqual({})
})

it('keeps Windows client hints and the embed fix in the same listener', () => {
  const { request, filter } = setup(true)
  expect(filter.urls).toEqual(['*://*/*'])
  expect(request()).toEqual({
    Referer: YOUTUBE_APP_REFERER,
    'sec-ch-ua-platform': 'Windows'
  })
  expect(request({ url: 'https://example.com/' })).toEqual({
    'sec-ch-ua-platform': 'Windows'
  })
})
