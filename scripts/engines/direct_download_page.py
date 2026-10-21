"""Read observed download anchors/metadata. Never fetch, submit forms or save tokens."""
import json
import re
import unicodedata
from urllib.parse import urljoin
from scrapling.parser import Selector


def control_label(value):
    value = unicodedata.normalize('NFKC', value).lower()
    value = re.sub(r'\S+\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)\b', '<arquivo>', value, flags=re.I)
    while value and not value[0].isalpha():
        value = value[1:]
    while value and not (value[-1].isalnum() or value[-1] == '>'):
        value = value[:-1]
    return ' '.join(value.split())


def learned_actions(page, references):
    if not isinstance(references, list) or len(references) > 12:
        return []
    actions = []
    for element in page.css('a, button, input[type="button"], input[type="submit"]')[:200]:
        node, attrs = element._root, element.attrib
        if node.xpath('ancestor::form') or attrs.get('form') or node.xpath('ancestor-or-self::*[@hidden or @aria-hidden="true"]'):
            continue
        if 'disabled' in attrs or attrs.get('aria-disabled') == 'true':
            continue
        raw = element.get_all_text() or attrs.get('aria-label', '') or attrs.get('value', '')
        action = {'tag': element.tag.upper(), 'label': control_label(raw)}
        for attribute, key in [('id', 'id'), ('name', 'name'), ('data-testid', 'testId')]:
            value = attrs.get(attribute, '')
            if re.fullmatch(r'[a-z][a-z0-9_-]{0,47}', value, flags=re.I) and not re.search(r'\d{4}|[a-f0-9]{16}', value, flags=re.I):
                action[key] = value
        rows = node.xpath('ancestor::li[1]')
        if rows:
            row = re.match(r'^(Direct|DataNodes|FileKeeper|FileDitch|Pixeldrain|Gofile|VikingFile|MegaDB|Buzzheavier)(?=\s|Download|Loading|$)', ''.join(rows[0].itertext()).strip(), flags=re.I)
            if row:
                action['row'] = row.group(1).lower()
        if any(isinstance(reference, dict) and not reference.get('form') and all(action.get(key) == reference.get(key) for key in ['tag', 'label', 'row']) for reference in references):
            actions.append(action)
    # Ghost revalidates descriptors and the live Electron control before acting.
    return [action for action in actions if sum(all(action.get(key) == other.get(key) for key in ['tag', 'label', 'row']) for other in actions) == 1][:12]


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
    return {'capability': 'direct-download-page-v1', 'links': links, 'entries': entries,
            'actions': learned_actions(page, request.get('learnedControls', []))}


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
    request['learnedControls'] = [{'tag': 'BUTTON', 'label': 'obter pacote', 'id': 'old-control'}]
    request['html'] = '<section><button id="new-control">Obter pacote</button></section>'
    assert direct_download_page(request)['actions'] == [{'tag': 'BUTTON', 'label': 'obter pacote', 'id': 'new-control'}]
    request['html'] = '<button>Obter pacote</button><button>Obter pacote</button>'
    assert direct_download_page(request)['actions'] == []
    request['html'] = '<form><button>Obter pacote</button></form><button hidden>Obter pacote</button>'
    assert direct_download_page(request)['actions'] == []
