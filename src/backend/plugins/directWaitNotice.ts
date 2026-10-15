export const DIRECT_MANUAL_GRACE_MS = 10000
export const DIRECT_HOSTER_WAIT_MS = 45000
export const DIRECT_MANUAL_WAIT_MS = 120000

export interface DirectHosterAttempt {
  hoster: string
  next?: string
  attempt: number
  attempts: number
  phase?: 'automatic' | 'manual'
  confirmOnGamePage?: boolean
}

/** Ghost's notice is informative and leaves the hoster's download controls usable. */
export function directWaitNoticeScript(deadline: number, context: DirectHosterAttempt, id = 'ghost-direct-download-wait-notice'): string {
  return `(() => {
    const id = ${JSON.stringify(id)};
    const deadline = ${JSON.stringify(deadline)};
    const context = ${JSON.stringify(context)};
    if (!document.body) return false;
    const existing = document.getElementById(id);
    if (existing?.dataset.deadline === String(deadline)) return true;
    existing?.remove();
    const notice = document.createElement('aside');
    notice.id = id; notice.dataset.deadline = String(deadline);
    notice.style.cssText = 'position:fixed;top:12px;left:16px;right:16px;z-index:2147483647;padding:14px 18px;border:1px solid #00d4e5;border-radius:12px;background:#111c25;color:#edf9fb;font:14px/1.5 "Segoe UI",sans-serif;box-shadow:0 8px 24px #0008;pointer-events:none';
    const title = document.createElement('strong');
    title.textContent = 'Ghost · ' + context.hoster + ' · Tentativa ' + context.attempt + ' de ' + context.attempts;
    const explanation = document.createElement('div');
    explanation.textContent = context.confirmOnGamePage
      ? 'O link anterior ficou indisponível. Clique em Download na página deste jogo e conclua a verificação, se solicitada.'
      : 'Se necessário, confirme o download ou a verificação abaixo. Mantenha esta janela aberta e aguarde.';
    const timer = document.createElement('div');
    timer.setAttribute('role', 'timer'); timer.setAttribute('aria-live', 'off');
    timer.style.color = '#00e5ff';
    notice.append(title, explanation, timer); document.body.append(notice);
    const update = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timer.textContent = context.phase === 'manual'
        ? (seconds ? 'Aguardando sua confirmação por mais ' + seconds + 's.' + (context.next ? ' Depois tentaremos ' + context.next + '.' : '') : 'Verificando o resultado da confirmação…')
        : context.next
        ? (seconds ? 'Se o download não iniciar, o Ghost tentará ' + context.next + ' em ' + seconds + 's.' : 'Aguarde: o Ghost está tentando ' + context.next + '…')
        : (seconds ? 'Última hospedagem: aguardando o início por mais ' + seconds + 's. Depois você poderá retomar em Downloads.' : 'Aguarde: verificando o resultado da última hospedagem…');
    };
    update();
    const interval = setInterval(() => { if (!notice.isConnected) clearInterval(interval); else update(); }, 1000);
    return true;
  })()`
}
