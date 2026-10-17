import { makeHandlerInvoker } from '../ipc'

export const releasesCatalog = makeHandlerInvoker('releasesCatalog')
export const releasesProduct = makeHandlerInvoker('releasesProduct')
export const releasesDrm = makeHandlerInvoker('releasesDrm')
export const releasesDrmSetManual = makeHandlerInvoker('releasesDrmSetManual')
export const releasesDrmOpenSource = makeHandlerInvoker('releasesDrmOpenSource')
export const releasesDrmVerifyHiz = makeHandlerInvoker('releasesDrmVerifyHiz')
export const releasesDrmEndManual = makeHandlerInvoker('releasesDrmEndManual')
export const releasesNotifyToday = makeHandlerInvoker('releasesNotifyToday')
export const syncLocalStorageBackup = makeHandlerInvoker('syncLocalStorageBackup')
