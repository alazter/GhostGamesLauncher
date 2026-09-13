import { makeHandlerInvoker, frontendListenerSlot } from '../ipc'

export const pluginsGetList = makeHandlerInvoker('pluginsGetList')
export const pluginsToggle = makeHandlerInvoker('pluginsToggle')
export const pluginsInstall = makeHandlerInvoker('pluginsInstall')
export const pluginsInstallFromBuffer = makeHandlerInvoker('pluginsInstallFromBuffer')
export const pluginsUninstall = makeHandlerInvoker('pluginsUninstall')
export const pluginsLoadUnpacked = makeHandlerInvoker('pluginsLoadUnpacked')
export const pluginsPack = makeHandlerInvoker('pluginsPack')
export const pluginsSearchSources = makeHandlerInvoker('pluginsSearchSources')
export const pluginsGetDownloadSources = makeHandlerInvoker('pluginsGetDownloadSources')
export const pluginsStartDownload = makeHandlerInvoker('pluginsStartDownload')
export const pluginsGetActiveCSS = makeHandlerInvoker('pluginsGetActiveCSS')

export const onPluginsUpdated = frontendListenerSlot('plugins-updated')
export const onPluginsCssChanged = frontendListenerSlot('plugins-css-changed')
