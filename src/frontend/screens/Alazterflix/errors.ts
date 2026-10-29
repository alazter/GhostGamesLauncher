export const describeMediaError = (error: unknown): string => {
  let message = error instanceof Error ? error.message : String(error || '')
  message = message.replace(/^Error invoking remote method '[^']+':\s*/i, '')
  message = message.replace(/^Error:\s*/i, '')
  return message.trim() || 'Ocorreu um erro desconhecido.'
}
