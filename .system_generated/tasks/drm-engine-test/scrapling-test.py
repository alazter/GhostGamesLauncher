"""Public page test with disposable Chrome profiles; never reads account cookies."""
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
from importlib.metadata import version
from scrapling.fetchers import StealthySession

ROOT = Path(__file__).resolve().parent
SITE = sys.argv[1]
RUN = sys.argv[2] if len(sys.argv) > 2 else 'initial'
TARGETS = {
    'AnkerGames': 'https://ankergames.net/game/minecraft-dungeons-ii',
    'HizSearch': 'https://hizsearch.pages.dev/',
}
snapshot = {}
responses = []

def setup(page):
    def received(response):
        parsed = urlparse(response.url)
        if parsed.hostname in ['hizapi.onrender.com', 'hizsearch.pages.dev', 'ankergames.net']:
            # Record status and path only, never headers, cookies, tokens or query strings.
            safe_path = '/cdn-cgi/challenge-platform/[redacted]' if parsed.path.startswith('/cdn-cgi/challenge-platform/') else parsed.path
            record = {'host': parsed.hostname, 'path': safe_path, 'status': response.status}
            if record not in responses and len(responses) < 40:
                responses.append(record)
    page.on('response', received)

def inspect(page):
    page.wait_for_timeout(6000)
    snapshot.update(page.evaluate('''() => ({
      title: document.title,
      headings: Array.from(document.querySelectorAll('h1,h2')).slice(0,8).map(e => e.textContent.trim().slice(0,160)),
      matchedGame: document.querySelector('h1')?.textContent.trim() === 'Minecraft Dungeons II',
      hasSearch: Array.from(document.querySelectorAll('input')).some(e => /search/i.test(e.type + ' ' + e.placeholder) && e.getBoundingClientRect().width > 0),
      challenge: /just a moment|verify.*human|verification required|verification challenge|performing security verification/i.test(document.title + ' ' + (document.body?.innerText || '')),
      turnstile: !!document.querySelector('iframe[src*="challenges.cloudflare.com"],.cf-turnstile'),
      textLength: (document.body?.innerText || '').length,
      frameHosts: Array.from(document.querySelectorAll('iframe[src]')).map(e => { try { return new URL(e.src).hostname } catch { return '' } }).filter(Boolean)
    })'''))
    snapshot['browserFrameHosts'] = sorted(set(urlparse(frame.url).hostname for frame in page.frames if urlparse(frame.url).hostname))
    snapshot['inputs'] = page.locator('input').evaluate_all('(elements) => elements.map(e => ({type:e.type,disabled:e.disabled,visible:e.getBoundingClientRect().width>0,placeholder:e.placeholder.slice(0,80)}))')
    snapshot['needsVerification'] = snapshot['challenge'] or 'challenges.cloudflare.com' in snapshot['browserFrameHosts'] or any(item['disabled'] for item in snapshot['inputs'])
    if SITE == 'HizSearch' and not snapshot['needsVerification']:
        editable = page.locator('input[type="text"]:enabled').first
        if editable.count():
            editable.fill('Minecraft Dungeons II')
            editable.press('Enter')
            page.wait_for_timeout(7000)
            snapshot['matchingResultTexts'] = page.locator('a,h2,h3').evaluate_all('(elements) => elements.map(e => e.textContent.trim()).filter(text => /minecraft\\s+dungeons/i.test(text)).slice(0,12)')
    page.screenshot(path=str(ROOT / f'scrapling-{SITE}-{RUN}.png'), full_page=True)

started = time.monotonic()
result = {'engine': 'Scrapling ' + version('scrapling'), 'site': SITE, 'mode': 'stealth-auto-verification', 'run': RUN, 'persistentProfile': True}
try:
    with StealthySession(headless=True, real_chrome=True, solve_cloudflare=True,
                        timeout=60000, google_search=False, block_ads=True,
                        network_idle=(RUN == 'wait-and-reuse'),
                        user_data_dir=str(ROOT / ('scrapling-profile-' + SITE)),
                        locale='pt-BR', timezone_id='America/Sao_Paulo') as session:
        response = session.fetch(TARGETS[SITE], page_setup=setup, page_action=inspect)
        result.update({'status': response.status, 'url': response.url, 'page': snapshot, 'responses': responses})
except Exception as error:
    result.update({'error': str(error)[:1200], 'page': snapshot, 'responses': responses})
result['seconds'] = round(time.monotonic() - started, 1)
destination = ROOT / ('scrapling-' + SITE + '-' + RUN + '-result.json')
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False), flush=True)
