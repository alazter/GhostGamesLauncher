import { directNonDownloadUrl } from './directHosters'

/** Known terminal source page, distinct from an interactive verification. */
export function sourceDownloadPageStatus() {
  const title = (document.title || '').trim()
  const headings = [...document.querySelectorAll('h1, h2')].map(node => (node.textContent || '').trim())
  const unavailable = /^ops matey[,]? no downloads here/i.test(title) ||
    (headings.some(text => /^download unavailable$/i.test(text)) &&
      /please complete the verification challenge and try again|error details|return home/i.test(document.body?.textContent || ''))
  return { unavailable, ready: document.readyState === 'interactive' || document.readyState === 'complete' }
}

export function sourceDownloadStatusScript(): string {
  return `(${sourceDownloadPageStatus.toString()})()`
}

/** Observe real download controls, preserving POST handlers on buttons. */
export function sourceDownloadScript(domains: string[]): string {
  return `(() => {
    if ((${sourceDownloadPageStatus.toString()})().unavailable) return { unavailable: true };
    const domains = ${JSON.stringify(domains)};
    const blocked = ${directNonDownloadUrl.toString()};
    const label = node => (node.textContent || node.getAttribute('aria-label') || '').trim().replace(/^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$/gu, '');
    const excluded = /torrent|magnet|report|abuse|denunciar|donat|premium|download manager|soundtrack|update only|fix only|crack only/i;
    const rank = text => /^(?:continue to|continuar (?:para|em))\\s+\\S/i.test(text) ? 3
      : /^(?:download(?:\\s+(?:now|game|here|file|links?|mirror))?|baixar(?:\\s+(?:agora|jogo|arquivo))?)/i.test(text) ? 2
        : /^(?:Direct|FileKeeper|FileDitch|Pixeldrain|Gofile|VikingFile|MegaDB|Buzzheavier|DataNodes)(?:\\s*(?:mirror|link|download|\\d+))?$/i.test(text) ? 1 : 0;
    const allowed = raw => {
      try { const url = new URL(raw, location.href); return url.protocol === 'https:' && !url.port && !url.username && !url.password && !blocked(url.href) &&
        domains.some(domain => { const host = domain.replace(/^\\*\\./, ''); return url.hostname === host || url.hostname.endsWith('.' + host); }); }
      catch { return false; }
    };
    const links = [...document.querySelectorAll('main a[href], article a[href], a[href]')].flatMap(node => {
      const text = label(node); const score = excluded.test(text) ? 0 : rank(text);
      if (!score || !allowed(node.href) || node.href === location.href || node.getAttribute('href').startsWith('#')) return [];
      return [{ url: node.href, score, label: text }];
    });
    const candidates = [...new Map(links.sort((a,b) => b.score - a.score).map(item => [item.url, item])).values()];
    if (candidates.length) return { candidates: candidates.map(item => ({url:item.url,label:item.label})) };
    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog, [x-show*="downloadOpen"]')].filter(node => node.getClientRects().length);
    const scope = dialogs.at(-1) || document;
    const controls = [...scope.querySelectorAll('button, input[type="submit"], a.download-button, a[role="button"]')];
    const buttons = controls.filter(node => {
      const text = label(node) || node.value || '';
      const href = node.getAttribute('href');
      const action = [text, node.id, node.getAttribute('title'), node.getAttribute('aria-label'), node.getAttribute('data-action'), node.getAttribute('onclick')].filter(Boolean).join(' ');
      return !node.disabled && node.getAttribute('aria-disabled') !== 'true' && node.getClientRects().length &&
        !node.dataset.ghostDownloadAttempt && !excluded.test(action) && (rank(text) >= 2 || /^(?:direct|datanodes)$/i.test(text)) &&
        (!href || href.startsWith('#') || allowed(node.href)) &&
        (!node.form || (allowed(node.form.action) && new URL(node.form.action).origin === location.origin));
    });
    // Anker renders hoster choices as href="#" with its own request handler.
    // Select one real row, preserving the site's signed-link generation.
    const hosterRows = buttons.filter(node => /^(?:Direct|FileKeeper|FileDitch|DataNodes|Pixeldrain|Gofile|VikingFile|MegaDB|Buzzheavier)(?=\\s|Download|Loading|$)/i.test(node.closest('li')?.textContent.trim() || ''));
    hosterRows.sort((a,b) => Number(/^Direct(?=\\s|Download|Loading|$)/i.test(b.closest('li')?.textContent.trim() || '')) - Number(/^Direct(?=\\s|Download|Loading|$)/i.test(a.closest('li')?.textContent.trim() || '')));
    if (hosterRows.length || buttons.length === 1) {
      const button = hosterRows[0] || buttons[0];
      button.dataset.ghostDownloadAttempt = '1'; button.click(); return { clicked: true };
    }
    if (controls.some(node => (node.disabled || node.dataset.ghostDownloadAttempt) && rank(label(node) || node.value || '') >= 2)) return { waiting: true };
    const challenge = [...document.querySelectorAll('input[type="password"], .g-recaptcha, .cf-turnstile')]
      .some(node => [...node.getClientRects()].some(rect => rect.width > 40 && rect.height > 20));
    return challenge ? { manual: true, requiresInteraction: true } : { manual: true };
  })()`
}
