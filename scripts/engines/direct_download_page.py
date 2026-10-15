"""Read observed download anchors/metadata. Never fetch, submit forms or save tokens."""
import json
from urllib.parse import urljoin
from scrapling.parser import Selector


def direct_download_page(request):
    page = Selector(request['html'], url=request['base'])
    links, entries = [], []
    for element in page.css('a[href]')[:200]:
        attrs = element.attrib
        title = ' '.join(element.get_all_text().split())
        if not title:
            title = attrs.get('aria-label') or attrs.get('title') or attrs.get('download') or ''
        if not title:
            images = element.css('img[alt]')
            title = images[0].attrib.get('alt', '') if images else ''
        links.append({'url': urljoin(request['base'], attrs['href']), 'title': title[:500]})
    for element in page.css('[data-links]')[:200]:
        try:
            value = json.loads(element.attrib['data-links'])
            if isinstance(value, list):
                entries.extend(value[:200 - len(entries)])
        except (ValueError, TypeError):
            pass
        if len(entries) == 200:
            break
    return {'capability': 'direct-download-page-v1', 'links': links, 'entries': entries}


def self_test():
    request = {'base': 'https://ankergames.net/game/test',
               'html': '<a href="/download/test" aria-label="Download"></a><a href="https://datanodes.to/test"><img alt="DataNodes"></a>'}
    result = direct_download_page(request)
    assert result['links'] == [{'url': 'https://ankergames.net/download/test', 'title': 'Download'},
                               {'url': 'https://datanodes.to/test', 'title': 'DataNodes'}]
    request['html'] = '<form action="/download"><input type="hidden" name="token" value="private"><button>Download</button></form>'
    assert direct_download_page(request)['links'] == []  # POST stays in Chromium.
    request['html'] = '<div data-links=\'[{"file_name":"Game.rar","direct_link":"https://filekeeper.net/test"}]\'></div>'
    assert direct_download_page(request)['entries'] == [{'file_name': 'Game.rar', 'direct_link': 'https://filekeeper.net/test'}]
