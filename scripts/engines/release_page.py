"""Public Releases.com HTTP pages, with no browser session or challenge solving."""
import re
from urllib.parse import urlparse


def valid_release_url(value):
    if not isinstance(value, str) or len(value) > 4000:
        return False
    target = urlparse(value)
    return (target.scheme == 'https' and target.netloc == 'www.releases.com'
            and not target.fragment
            and bool(re.fullmatch(
                r'/(?:calendar(?:/[a-z0-9_-]+)?|hot(?:/[a-z0-9_/-]+)?|partial/Releases\.Www\.PL\.(?:Product\.Index|Calendar\.Group))',
                target.path)))


def release_page(request, fetch=None):
    target = request.get('url')
    proxy = urlparse(request.get('proxy', ''))
    if (not valid_release_url(target) or proxy.scheme != 'http'
            or proxy.hostname != '127.0.0.1' or not proxy.port
            or not proxy.username or not proxy.password):
        raise ValueError('Invalid public Releases request')
    if fetch is None:
        from scrapling.fetchers import Fetcher
        fetch = Fetcher.get
    # Redirects and region/session controls are handled by Ghost, not this worker.
    response = fetch(target, proxy=request['proxy'], timeout=16, retries=1,
                     follow_redirects=False, verify=True)
    html = response.html_content if 200 <= response.status < 300 else ''
    if not isinstance(html, str) or len(html.encode('utf-8')) > 8 * 1024 * 1024:
        raise ValueError('Public Releases response too large')
    return {'capability': 'release-page-v1', 'status': response.status,
            'url': target, 'html': html}


def self_test():
    from types import SimpleNamespace
    for path in ['/calendar', '/calendar/games?f=v%3APC', '/hot/games/monthly',
                 '/partial/Releases.Www.PL.Product.Index?ProductSlug=test&RegionId=uk',
                 '/partial/Releases.Www.PL.Calendar.Group?Code=Y2026-M10-D16']:
        assert valid_release_url('https://www.releases.com' + path)
    for url in ['http://www.releases.com/calendar', 'https://www.releases.com:443/calendar',
                'https://evil.test/calendar', 'https://www.releases.com/login',
                'https://user@www.releases.com/calendar', 'https://www.releases.com/calendar#fragment']:
        assert not valid_release_url(url)
    request = {'url': 'https://www.releases.com/calendar',
               'proxy': 'http://ghost:test@127.0.0.1:12345'}

    def fixture(url, **options):
        assert url == request['url'] and options['proxy'] == request['proxy']
        assert options['follow_redirects'] is False and options['verify'] is True
        return SimpleNamespace(status=200, html_content='<main>Calendar</main>')

    assert release_page(request, fixture)['html'] == '<main>Calendar</main>'
    assert release_page(request, lambda *_args, **_kwargs: SimpleNamespace(status=403))['status'] == 403
    try:
        release_page({**request, 'proxy': 'http://evil.test:12345'}, fixture)
    except ValueError:
        pass
    else:
        raise AssertionError('Proxy must be local and authenticated')
