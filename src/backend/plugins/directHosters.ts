export type DirectHoster = 'FileDitch' | 'FileKeeper' | 'Pixeldrain' | 'Gofile' | 'VikingFile' | 'DataNodes'

export const DIRECT_HOSTERS: Record<DirectHoster, string[]> = {
  DataNodes: ['datanodes.to'],
  // Real "⬇ Baixar" href observed in the user's UNO landing page on 14/10/2026.
  // The signed relay has an opaque pathname, not the archive's basename.
  FileDitch: ['fileditch.com', 'fileditchfiles.st', 'blehpooffileditch.org', 'blehpooffileditchstuff.org',
    // Final redirect observed from the signed relay during the real fix capture.
    'alpha.struggleditchfr810.st'],
  // Observed final signed download relay from FileKeeper on 14/10/2026.
  FileKeeper: ['filekeeper.net', 'tunnel1.dlproxy.uk'],
  Pixeldrain: ['pixeldrain.com'],
  Gofile: ['gofile.io'],
  // Observed redirect from vikingfile.com/f/<id> on 14/10/2026.
  VikingFile: ['vikingfile.com', 'vik1ngfile.site']
}

export function directHoster(value: string): DirectHoster | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return
    return (Object.keys(DIRECT_HOSTERS) as DirectHoster[]).find(name =>
      DIRECT_HOSTERS[name].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)))
  } catch { return undefined }
}

/** A report URL can end with the exact archive name; it is still not a download. */
export function directNonDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const nonDownload = /^(?:report(?:[-_ ]?(?:abuse|file))?|abuse|delete|remove)(?:\.(?:php|html?))?$/i
    let path = url.pathname
    for (let i = 0; i < 2; i++) path = decodeURIComponent(path)
    return url.hostname.split('.').some(part => nonDownload.test(part)) ||
      path.split('/').some(part => nonDownload.test(part)) ||
      ['action', 'op', 'do', 'mode', 'page', 'tab'].some(key => nonDownload.test(url.searchParams.get(key) || ''))
  } catch { return true }
}

/** Only run inside a validated hoster document; no advertising click handlers. */
export function directHosterScript(name?: string, domains = Object.values(DIRECT_HOSTERS).flat()): string {
  return `(() => {
    const explicit = ${JSON.stringify(name || '')};
    const filenameNodes = explicit ? [] : [...document.querySelectorAll('#dl-filename, [data-filename], input[name="fname"], .dfilename, .filename, meta[property="og:title"], h1, h2, h3, h4, [download], span, p')];
    const names = [...new Set(filenameNodes.map(node => node.getAttribute('data-filename') || node.getAttribute('content') || node.getAttribute('download') || (node.matches?.('input[name="fname"]') ? node.getAttribute('value') : '') || node.textContent?.trim() || '')
      .filter(text => text.length < 241 && !text.includes('/') && /\\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)$/i.test(text)))];
    const expected = explicit || (names.length === 1 ? names[0] : '');
    const withoutName = text => expected ? text.split(expected).join(' ') : text;
    const allowedHosts = ${JSON.stringify(domains)};
    const nonDownloadUrl = ${directNonDownloadUrl.toString()};
    const nonDownloadAction = /(?:\\breport\\b|\\babuse\\b|\\bdelete\\b|\\bremove\\b|den[uú]ncia)/i;
    const safeAction = element => {
      if (nonDownloadAction.test([element.textContent, element.title, element.getAttribute('aria-label'),
          element.id, element.getAttribute('data-action'), element.getAttribute('onclick')]
          .filter(Boolean).map(withoutName).join(' '))) return false;
      if (element.href && nonDownloadUrl(element.href)) return false;
      if (element.hasAttribute('formaction') && nonDownloadUrl(element.formAction)) return false;
      const form = element.form || element.closest('form');
      return !(form && nonDownloadUrl(form.action));
    };
    const downloadLabel = element => [
      element.textContent, element.title, element.getAttribute('aria-label')
    ].filter(Boolean).some(label => /^(?:download(?:\\s+(?:file|now|archive))?|baixar(?:\\s+(?:arquivo|agora))?)$/i
      .test(withoutName(label).replace(/^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$/gu, '').trim()));
    const verification = document.querySelector('.verifying-overlay');
    if (verification && verification.getClientRects().length &&
        getComputedStyle(verification).visibility !== 'hidden' && getComputedStyle(verification).display !== 'none')
      return { waiting: true };
    const fileIdentified = Boolean(expected && document.body?.textContent.includes(expected));
    const links = [...document.querySelectorAll('a[href]')].filter(a => {
      if (!safeAction(a) || nonDownloadUrl(a.href)) return false;
      let url, filename;
      try { url = new URL(a.href); filename = decodeURIComponent(url.pathname.split('/').pop()); } catch { return false; }
      if (url.protocol !== 'https:' || url.port || url.username || url.password || a.getAttribute('href').startsWith('#') ||
          !allowedHosts.some(host => url.hostname === host.replace(/^\\*\\./, '') || url.hostname.endsWith('.' + host.replace(/^\\*\\./, '')))) return false;
      const designated = Boolean(expected && a.getAttribute('download') === expected);
      return designated || (fileIdentified && downloadLabel(a)) ||
        (filename === expected && a.textContent.trim() === expected);
    });
    if (links.length === 1) return { url: links[0].href };
    const selectors = location.hostname.endsWith('datanodes.to')
      ? ['#downloadbtn', '#downloadbtn2', '#download-button', '[name="method_free"]', '[data-action="download"]']
      : location.hostname.endsWith('filekeeper.net')
      ? ['#download-button', '#downloadbtn', '#downloadbtn2', '#method_free', '[name="method_free"]']
      : /(?:vikingfile.com|vik1ngfile.site)$/.test(location.hostname)
        ? ['#downloadButton', '#downloadBtn', '#download-file', '[data-action="download"]']
        : location.hostname.endsWith('gofile.io')
          ? ['[data-testid="download-button"]', '[data-action="download"]', 'button[aria-label="Download"]'] : [];
    if (fileIdentified) {
      const countdown = document.querySelector('#download-countdown');
      if (countdown && !document.querySelector('#download-button') &&
          countdown.dataset.hasCaptcha !== 'true' && countdown.dataset.hasPassword !== 'true')
        return { waiting: true };
      for (const selector of selectors) {
        const buttons = [...document.querySelectorAll(selector)].filter(b => safeAction(b) && !b.disabled && b.getClientRects().length);
        if (buttons.length !== 1) continue;
        const button = buttons[0];
        if (button.dataset.ghostDownloadAttempt) continue;
        if (button.form && new URL(button.form.action).origin !== location.origin) continue;
        button.dataset.ghostDownloadAttempt = '1'; button.click(); return { clicked: true };
      }
      // App-rendered hoster rows can change classes. Locate the file by name,
      // then require one download action in its own row, never an ad popup.
      for (const label of document.querySelectorAll('span, a, p, div, h1, h2, h3, code')) {
        if (label.textContent.trim() !== expected || label.children.length) continue;
        let row = label.parentElement;
        for (let depth = 0; row && depth < 4; depth++, row = row.parentElement) {
          const actions = [...row.querySelectorAll('button, a[href], a[role="button"]')].filter(button =>
            safeAction(button) && !button.disabled && button.getClientRects().length &&
            (downloadLabel(button) || button.querySelector('.fa-download, [data-icon="download"]')));
          if (actions.length !== 1 || actions[0].dataset.ghostDownloadAttempt) continue;
          actions[0].dataset.ghostDownloadAttempt = '1'; actions[0].click(); return { clicked: true };
        }
      }
    }
    const interaction = [...document.querySelectorAll('input[type="password"], input[name="captcha"], .g-recaptcha, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]')]
      .some(element => [...element.getClientRects()].some(rect => rect.width > 40 && rect.height > 20));
    return interaction ? { manual: true, requiresInteraction: true } : { manual: true };
  })()`
}
