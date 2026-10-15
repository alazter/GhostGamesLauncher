export const DIRECT_LEARNING_CLICK = 'ghost-direct-learning-click'
export const DIRECT_LEARNING_MODE = 'ghost-direct-learning-mode'

export interface DownloadAction {
  tag: 'A' | 'BUTTON' | 'INPUT'
  label: string
  id?: string
  name?: string
  testId?: string
  row?: string
  form?: { method: string; fields: string[] }
}

/** Self-contained: also runs in a hoster's DOM during matching. No values/HTML. */
export function describeDownloadAction(node: Element): DownloadAction | undefined {
  const text = (raw: string | null) => (raw || '').normalize('NFKC').toLowerCase()
    .replace(/\S+\.(?:zip|rar|7z|tar|nsp|xci|nsz|xcz)\b/gi, '<arquivo>')
    .replace(/^\P{L}+|[^\p{L}\p{N}>]+$/gu, '').replace(/\s+/g, ' ').trim()
  const forbidden = /report|abuse|denunc|delete|remove|exclu|captcha|verif|human|login|sign.?in|entrar|senha|password|donat|premium|subscribe|comprar|purchase|\bbuy\b|\bpay\b|checkout|upgrade|install|extension|torrent|magnet|copy|clipboard|copiar|upload|enviar/i
  const tag = node.tagName
  if (!['A', 'BUTTON', 'INPUT'].includes(tag) || !node.getClientRects().length ||
      node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return
  if (tag === 'INPUT' && !['submit', 'button'].includes((node.getAttribute('type') || '').toLowerCase())) return
  const label = text(node.textContent || node.getAttribute('aria-label') || (tag === 'INPUT' ? node.getAttribute('value') : ''))
  if (label.length > 80 || /https?:|[?=&]/i.test(label) || forbidden.test([
    label, node.id, node.getAttribute('title'), node.getAttribute('data-action'), node.getAttribute('onclick')
  ].join(' '))) return
  const stable = (raw: string | null) => raw && /^[a-z][a-z0-9_-]{0,47}$/i.test(raw) && !/\d{4}|[a-f0-9]{16}/i.test(raw) ? raw : undefined
  const id = stable(node.id)
  const name = stable(node.getAttribute('name'))
  const testId = stable(node.getAttribute('data-testid'))
  if (!label && !id && !name && !testId) return
  if (!/download|baixar|obter|arquivo|package|continue|continuar|gerar|generate|create|retrieve|receber|fetch|pegar|direct|free|slow|\bget\b|<arquivo>/i.test([label, id, name, testId].join(' '))) return
  const row = /^(Direct|DataNodes|FileKeeper|FileDitch|Pixeldrain|Gofile|VikingFile|MegaDB|Buzzheavier)(?=\s|Download|Loading|$)/i
    .exec(node.closest('li')?.textContent?.trim() || '')?.[1]?.toLowerCase()
  const form = (node as HTMLButtonElement).form || node.closest('form')
  if (form?.querySelector('input[type="password"], input[name*="captcha"], .g-recaptcha, .cf-turnstile')) return
  const fields = form ? [...form.querySelectorAll('input[name], select[name], textarea[name]')]
    .map(field => field.getAttribute('name') || '').filter(field => /^[a-z][a-z0-9_-]{0,47}$/i.test(field)).sort().slice(0, 20) : undefined
  return { tag: tag as DownloadAction['tag'], label, ...(id ? { id } : {}), ...(name ? { name } : {}),
    ...(testId ? { testId } : {}), ...(row ? { row } : {}),
    ...(form ? { form: { method: form.method.toLowerCase(), fields: fields! } } : {}) }
}
