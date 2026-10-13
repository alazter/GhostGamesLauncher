"""Ghost protocol 1: HTML parsing plus an explicit, restricted manual DRM reader."""
import json
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import urljoin, urlparse
from importlib.metadata import version
from scrapling.parser import Selector
from scrapling.core.storage import SQLiteStorageSystem
from release_selectors import release_selectors, self_test as release_self_test


class GhostStorage(SQLiteStorageSystem.__wrapped__):
    closed = False

    def _get_base_url(self):
        # Ghost already provides a canonical provider origin. No public-suffix download.
        return self.url

    def close(self):
        if not self.closed:
            super().close()
            self.closed = True


def parse(request):
    if request.get('protocol') != 1 or len(request.get('html', '')) > 8 * 1024 * 1024:
        raise ValueError('Invalid request')
    if request.get('operation') == 'manual-drm-page-v1':
        return manual_drm_page(request)
    if request.get('operation') == 'release-selectors-v1':
        return release_selectors(request, GhostStorage)
    if request.get('operation') == 'online-fix-torrent-links-v1':
        page = Selector(request['html'], url=request['base'])
        links = []
        for element in page.css('a[href]'):
            target = urljoin(request['base'], element.attrib.get('href', ''))
            parsed = urlparse(target)
            if (parsed.scheme == 'https' and parsed.hostname == 'uploads.online-fix.me'
                    and parsed.port in (None, 443, 2053) and not parsed.username
                    and not parsed.password and not parsed.fragment
                    and parsed.path.startswith('/torrents/')):
                links.append({'url': target, 'title': ' '.join(element.get_all_text().split())[:200]})
            if len(links) == 200:
                break
        return links
    base = request['base']
    provider = request.get('provider', 'com.ghost.ankergames-source')
    scope = request['scope']
    if not re.fullmatch(r'[a-f0-9]{64}', scope):
        raise ValueError('Invalid scope')
    storage = Path(request['storage']) / (scope + '.db')
    database = GhostStorage(str(storage), url=base)
    try:
        page = Selector(request['html'], url=base, adaptive=True, _storage=database)
        selector = request.get('selector', '.post-title a')
        if not re.fullmatch(r'[a-zA-Z0-9_.# >-]{1,120}', selector):
            raise ValueError('Invalid selector')
        elements = page.css(selector)
        if elements:
            # Learn only validated game anchors, not unrelated advertisement controls.
            if all(valid_url(urljoin(base, el.attrib.get('href', '')), base, provider) for el in elements):
                elements = page.css(selector, auto_save=True)
        else:
            elements = page.css(selector, adaptive=True, percentage=85)
        if not elements:
            elements = page.css('a[href]')
        games = {}
        for el in elements:
            url = urljoin(base, el.attrib.get('href', ''))
            title = ' '.join(el.get_all_text().split())
            if valid_url(url, base, provider) and 2 <= len(title) <= 200 and title.lower() not in {'download', 'read more', 'login', 'register', 'home', 'next', 'previous'}:
                games[url] = {'url': url, 'title': title}
            if len(games) == 200:
                break
        return list(games.values())
    finally:
        database.close()


def valid_manual_url(url):
    parsed = urlparse(url)
    return (parsed.scheme == 'https' and parsed.netloc == 'ankergames.net'
            and not parsed.query and not parsed.fragment
            and bool(re.fullmatch(r'/(?:game|search)/[^/]+/?', parsed.path)))


def manual_drm_page(request):
    # This operation is never used by adaptive parsers or automatic DRM checks.
    from scrapling.fetchers import StealthySession
    target = request.get('url', '')
    proxy = urlparse(request.get('proxy', ''))
    if not valid_manual_url(target) or proxy.scheme != 'http' or proxy.hostname != '127.0.0.1' or not proxy.port or not proxy.username or not proxy.password:
        raise ValueError('Invalid manual DRM request')
    storage = Path(request['storage'])
    if not storage.is_absolute():
        raise ValueError('Invalid session directory')
    snapshot = {}

    def setup(page):
        def guard(route):
            url = urlparse(route.request.url)
            allowed = (url.scheme == 'https' and url.netloc in {'ankergames.net', 'challenges.cloudflare.com'}
                       and not re.search(r'\.(?:zip|rar|7z|exe|msi|torrent)(?:$|/)', url.path, re.I)
                       and not re.search(r'/(?:download|logout|login)(?:/|$)', url.path, re.I))
            if allowed:
                route.continue_()
            else:
                route.abort()
        page.context.route('**/*', guard)
        page.on('popup', lambda popup: popup.close())

    def inspect(page):
        if valid_manual_url(page.url):
            html = page.content()
            if len(html.encode('utf-8')) <= 2 * 1024 * 1024:
                snapshot.update(html=html, url=page.url)

    try:
        with StealthySession(headless=True, real_chrome=True, solve_cloudflare=True,
                             timeout=45000, retries=1, google_search=False, block_ads=True,
                             dns_over_https=False, block_webrtc=True, proxy=request['proxy'],
                             user_data_dir=str(storage), locale='pt-BR',
                             additional_args={'accept_downloads': False}) as browser:
            response = browser.fetch(target, page_setup=setup, page_action=inspect)
            if response.status == 404:
                return {'status': 404, 'url': target, 'html': ''}
            if not snapshot:
                return {'error': 'A fonte não forneceu uma página válida.'}
            return {'status': response.status, **snapshot}
    except Exception:
        return {'error': 'Scrapling não conseguiu acessar a fonte. Verifique o Chrome instalado e tente novamente.'}


def valid_url(url, base, provider='com.ghost.ankergames-source'):
    parsed = urlparse(url)
    if not (parsed.scheme == 'https' and parsed.netloc == urlparse(base).netloc
            and not parsed.query and not parsed.fragment):
        return False
    if provider == 'com.ghost.ankergames-source':
        return bool(re.fullmatch(r'/game/[^/]+/?', parsed.path))
    if provider == 'com.ghost.online-fix-source':
        return bool(re.fullmatch(r'/games/.+\.html', parsed.path))
    if provider not in {'com.ghost.steamrip-source', 'com.ghost.nxbrew-source', 'com.ghost.nswgf-source', 'com.ghost.romslab-source'}:
        return False
    return (parsed.path != '/' and not re.match(r'^/(?:category|tag|author|page|feed|wp-|contact|about|privacy|dmca|faq|search|comments|login|register|account|logout)(?:\b|/)', parsed.path, re.I)
            and not re.search(r'\.(?!html?$)[a-z0-9]+$', parsed.path.rstrip('/'), re.I))


def self_test():
    with tempfile.TemporaryDirectory() as folder:
        request = {'protocol': 1, 'base': 'https://example.com', 'storage': folder,
                   'scope': 'a' * 64, 'html': '<h2 class="post-title"><a href="/game/test">Test Game</a></h2>'}
        assert parse(request) == [{'url': 'https://example.com/game/test', 'title': 'Test Game'}]
        request['html'] = '<h2 class="changed-title"><a href="/game/test">Test Game</a></h2><a href="https://evil.test/game/ad">Advert</a>'
        assert parse(request) == [{'url': 'https://example.com/game/test', 'title': 'Test Game'}]
    for provider, path in [('com.ghost.online-fix-source', '/games/test.html'), ('com.ghost.steamrip-source', '/test-free-download/'), ('com.ghost.nxbrew-source', '/test-switch/'), ('com.ghost.nswgf-source', '/test-switch/'), ('com.ghost.romslab-source', '/test-switch/')]:
        assert valid_url('https://example.com' + path, 'https://example.com', provider)
        assert not valid_url('https://example.com/account', 'https://example.com', provider)
        assert not valid_url('https://example.com/archive.zip', 'https://example.com', provider)
        with tempfile.TemporaryDirectory() as folder:
            request = {'protocol': 1, 'base': 'https://example.com', 'storage': folder, 'scope': 'b' * 64,
                       'provider': provider, 'selector': '.entry-title a',
                       'html': f'<h2 class="entry-title"><a href="{path}">Test Game</a></h2>'}
            assert parse(request) == [{'url': 'https://example.com' + path, 'title': 'Test Game'}]
            request['html'] = f'<h2 class="changed-title"><a href="{path}">Test Game</a></h2><a href="/account">Account</a>'
            assert parse(request) == [{'url': 'https://example.com' + path, 'title': 'Test Game'}]
    release_self_test(GhostStorage)
    from scrapling.fetchers import StealthySession
    assert callable(StealthySession)
    assert valid_manual_url('https://ankergames.net/game/test')
    for target in ['https://ankergames.net/game/test?download=1', 'http://ankergames.net/game/test', 'https://ankergames.net.evil.test/game/test', 'https://ankergames.net/login']:
        assert not valid_manual_url(target)
    torrent_request = {'protocol': 1, 'operation': 'online-fix-torrent-links-v1',
                      'base': 'https://uploads.online-fix.me:2053/torrents/Test/',
                      'html': '<a href="Test.torrent">Test.torrent</a><a href="https://evil.test/Test.torrent">Ad</a>'}
    assert parse(torrent_request) == [{'url': 'https://uploads.online-fix.me:2053/torrents/Test/Test.torrent', 'title': 'Test.torrent'}]
    return {'protocol': 1, 'version': version('scrapling'), 'ok': True, 'capabilities': ['release-selectors-v1', 'manual-drm-page-v1', 'online-fix-torrent-links-v1']}


if __name__ == '__main__':
    if '--self-test' in sys.argv:
        result = self_test()
    else:
        payload = sys.stdin.buffer.read(9 * 1024 * 1024 + 1)
        if len(payload) > 9 * 1024 * 1024:
            raise ValueError('Input exceeds limit')
        result = parse(json.loads(payload.decode('utf-8')))
    print(json.dumps(result, ensure_ascii=True))
