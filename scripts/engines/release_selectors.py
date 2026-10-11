"""Release-specific adaptive selectors. Supplied HTML only; no HTTP or credentials."""
import json
import re
from pathlib import Path
from lxml import etree
from scrapling.parser import Selector

ROLES = (
    'RWPCC-CalendarItems-CardControl', 'RWPCC-CalendarItems-CardControl-Name',
    'RWPCC-CalendarItems-CardControl-Img', 'RWPCC-CalendarItems-CardControl-Date',
    'RWPCC-CalendarItems-TypeAndVersionsControl-Version', 'RWP-Calendar-Group',
    'RWPCC-InfinityDown-InfinityDownControl', 'RWP-Search-SearchResultView',
    'RWP-Search-SearchResultView-Item', 'RWP-Search-SearchResultView-ItemName',
    'RWP-Search-SearchResultView-ItemVersion', 'RWP-Search-SearchResultView-Img',
    'RWP-Product-MainInfoView-Name', 'RWP-Product-MainInfoView-MetaType',
    'RWP-Product-MainInfoView-Img', 'RWP-Product-MainInfoView-SummaryLong',
    'RWP-Product-MainInfoView-Summary', 'RWP-Product-MainInfoView-Tag',
    'RWP-Product-ReleaseInfoView-DateListItem', 'RWP-Product-ReleaseInfoView-Item',
    'RWP-Product-ReleaseInfoView-ItemReleaseDate'
)


def context(element):
    for parent in element._root.iterancestors():
        region = parent.get('data-regionid')
        if region:
            platform = parent.xpath('.//*[contains(concat(" ", normalize-space(@class), " "), " RWP-Product-ReleaseInfoView-Item ")]')
            return {'region': region, 'platform': ''.join(platform[0].itertext()).strip() if platform else ''}
    return {}


def release_selectors(request, storage_class):
    if request.get('mode') not in ('learn', 'repair') or request.get('base') != 'https://www.releases.com':
        raise ValueError('Invalid release selector request')
    scope = request.get('scope', '')
    if not re.fullmatch(r'[a-f0-9]{64}', scope):
        raise ValueError('Invalid release scope')
    directory = Path(request['storage']) / 'releases'
    directory.mkdir(parents=True, exist_ok=True)
    # Bounded reference storage. Old observations may be learned again later.
    references = sorted(directory.glob('*.json'), key=lambda p: p.stat().st_mtime)
    for old in references[:-119]:
        if old.stem != scope and re.fullmatch(r'[a-f0-9]{64}', old.stem):
            old.unlink()
            database_path = old.with_suffix('.db')
            if database_path.exists():
                database_path.unlink()
    metadata_path = directory / (scope + '.json')
    database = storage_class(str(directory / (scope + '.db')), url=request['base'])
    try:
        page = Selector(request['html'], url=request['base'], adaptive=True, _storage=database)
        if request['mode'] == 'learn':
            metadata = {}
            for role in ROLES:
                elements = page.css('.' + role)
                refs = []
                for index, element in enumerate(elements[:200]):
                    identifier = f'{role}:{index}'
                    page.save(element, identifier)
                    refs.append({'id': identifier, 'tag': element.tag, 'text': ' '.join(element.get_all_text().split()), 'context': context(element),
                                 'identity': {key: element.attrib[key] for key in ('href', 'data-regionid', 'data-calendarcode') if key in element.attrib}})
                if refs:
                    metadata[role] = refs
            temporary = metadata_path.with_suffix('.tmp')
            temporary.write_text(json.dumps(metadata), encoding='utf-8')
            temporary.replace(metadata_path)
            return {'capability': 'release-selectors-v1', 'learned': len(metadata)}
        if not metadata_path.exists():
            return {'capability': 'release-selectors-v1', 'html': request['html'], 'recovered': 0}
        metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        recovered = 0
        # Gather candidates before adding classes, so later lookups cannot see a partial repair.
        repairs = []
        for role, refs in metadata.items():
            if role not in ROLES or page.css('.' + role):
                continue
            for ref in refs:
                candidates = page.css('.' + role, identifier=ref['id'], adaptive=True, percentage=80)
                if len(candidates) != 1:
                    continue
                candidate = candidates[0]
                if candidate.tag != ref['tag'] or any(candidate.attrib.get(key) != value for key, value in ref['identity'].items()):
                    continue
                if ref.get('context') and context(candidate) != ref['context']:
                    continue
                # Without an identity attribute or a platform/region context, require
                # identical text as additional evidence. Similarity is not identity.
                if not ref['identity'] and not ref.get('context') and ' '.join(candidate.get_all_text().split()) != ref['text']:
                    continue
                repairs.append((candidate, role))
        for candidate, role in repairs:
            classes = candidate._root.get('class', '').split()
            if role not in classes:
                candidate._root.set('class', ' '.join(classes + [role]))
                recovered += 1
        return {'capability': 'release-selectors-v1', 'html': etree.tostring(page._root, encoding='unicode', method='html'), 'recovered': recovered}
    finally:
        database.close()


def self_test(storage_class):
    import tempfile
    with tempfile.TemporaryDirectory() as directory:
        request = {'base': 'https://www.releases.com', 'storage': directory, 'scope': 'c' * 64, 'mode': 'learn',
                   'html': '<html><body><h1 class="RWP-Product-MainInfoView-Name">Example game</h1><div data-regionid="us" class="RWP-Product-ReleaseInfoView-DateListItem"><b class="RWP-Product-ReleaseInfoView-Item">PC</b><span class="RWP-Product-ReleaseInfoView-ItemReleaseDate">Oct 3, 2026</span></div></body></html>'}
        assert release_selectors(request, storage_class)['learned'] == 4
        request['mode'] = 'repair'
        request['html'] = request['html'].replace('RWP-Product-MainInfoView-Name', 'new-title').replace('RWP-Product-ReleaseInfoView-ItemReleaseDate', 'new-date')
        result = release_selectors(request, storage_class)
        assert result['recovered'] == 2, result
        page = Selector(result['html'])
        assert page.css('.RWP-Product-MainInfoView-Name')[0].text == 'Example game'
        assert page.css('.RWP-Product-ReleaseInfoView-ItemReleaseDate')[0].text == 'Oct 3, 2026'
        request['html'] = '<html><body><a href="/account">Log in</a></body></html>'
        assert release_selectors(request, storage_class)['recovered'] == 0
