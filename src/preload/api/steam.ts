import { makeHandlerInvoker, makeListenerCaller } from '../ipc'

export const getSteamUserInfo = makeHandlerInvoker('getSteamUserInfo')
export const loginSteam = makeHandlerInvoker('loginSteam')
export const logoutSteam = makeListenerCaller('logoutSteam')
