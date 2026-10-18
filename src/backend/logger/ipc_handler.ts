import { addListener, addHandler } from 'backend/ipc'
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  statSync
} from 'graceful-fs'

import { showItemInFolder } from '../utils'

import { logInfo, logError, LogPrefix } from '.'
import { getLogFilePath } from './paths'
import {
  uploadLogFile,
  deleteUploadedLogFile,
  getUploadedLogFiles
} from './uploader'

const MAX_LOG_TAIL_BYTES = 256 * 1024
const MAX_LOG_LINES = 1000
const MAX_LOG_LINE_LENGTH = 2000

export function readLogFileTail(
  logPath: string,
  maxBytes = MAX_LOG_TAIL_BYTES,
  maxLines = MAX_LOG_LINES,
  maxLineLength = MAX_LOG_LINE_LENGTH
): string {
  if (!existsSync(logPath)) return ''

  try {
    const stat = statSync(logPath)
    if (!stat.isFile() || stat.size <= 0) return ''

    let rawContent = ''
    let wasByteTruncated = false

    if (stat.size <= maxBytes) {
      rawContent = readFileSync(logPath, 'utf-8')
    } else {
      wasByteTruncated = true
      const fd = openSync(logPath, 'r')
      try {
        const buffer = Buffer.alloc(maxBytes)
        const bytesRead = readSync(
          fd,
          buffer,
          0,
          maxBytes,
          stat.size - maxBytes
        )
        rawContent = buffer.subarray(0, bytesRead).toString('utf-8')
      } finally {
        closeSync(fd)
      }
      const firstNewlineIdx = rawContent.indexOf('\n')
      if (firstNewlineIdx !== -1) {
        rawContent = rawContent.slice(firstNewlineIdx + 1)
      }
    }

    let lines = rawContent.split('\n')
    let wasLineTruncated = wasByteTruncated
    if (lines.length > maxLines) {
      lines = lines.slice(-maxLines)
      wasLineTruncated = true
    }

    const sanitizedLines = lines.map((line) =>
      line.length > maxLineLength
        ? `${line.slice(0, maxLineLength)}... [line truncated]`
        : line
    )

    if (wasLineTruncated) {
      return ['...', ...sanitizedLines].join('\n')
    }
    return sanitizedLines.join('\n')
  } catch {
    return ''
  }
}

addListener('logInfo', (e, message) => logInfo(message, LogPrefix.Frontend))
addListener('logError', (e, message) => logError(message, LogPrefix.Frontend))

addHandler('getLogContent', (event, appNameOrRunner) => {
  const logPath = getLogFilePath(appNameOrRunner)
  return readLogFileTail(logPath)
})

addListener('showLogFileInFolder', (e, args) =>
  showItemInFolder(getLogFilePath(args))
)

addHandler('uploadLogFile', async (e, name, args) => uploadLogFile(name, args))
addHandler('deleteUploadedLogFile', async (e, url) =>
  deleteUploadedLogFile(url)
)
addHandler('getUploadedLogFiles', async () => getUploadedLogFiles())
