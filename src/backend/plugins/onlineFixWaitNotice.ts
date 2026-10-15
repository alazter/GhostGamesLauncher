import { directWaitNoticeScript, type DirectHosterAttempt } from './directWaitNotice'
export { DIRECT_MANUAL_GRACE_MS as ONLINE_FIX_MANUAL_GRACE_MS, DIRECT_HOSTER_WAIT_MS as ONLINE_FIX_HOSTER_WAIT_MS } from './directWaitNotice'
export type { DirectHosterAttempt as OnlineFixHosterAttempt } from './directWaitNotice'
export function onlineFixWaitNoticeScript(deadline: number, context: DirectHosterAttempt): string {
  return directWaitNoticeScript(deadline, context, 'ghost-online-fix-wait-notice')
}
