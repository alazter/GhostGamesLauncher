import { spawn } from 'child_process'

// No shell, bounded output and lifetime. Each worker handles one operation.
export function engineProcess(
  executable: string,
  args: string[],
  input?: string,
  timeout = 20000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUTF8: '1' }
    })
    const chunks: Buffer[] = []
    let size = 0
    let failed = false
    const fail = (error: Error) => {
      if (failed) return
      failed = true
      clearTimeout(timer)
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn(
          'taskkill',
          ['/PID', String(child.pid), '/T', '/F'],
          { windowsHide: true, stdio: 'ignore' }
        )
        killer.on('error', () => child.kill())
      } else child.kill()
      reject(error)
    }
    const timer = setTimeout(
      () => fail(new Error('O motor excedeu o tempo permitido.')),
      timeout
    )
    child.on('error', () =>
      fail(new Error('Não foi possível iniciar o motor.'))
    )
    child.stderr.on('data', () => undefined)
    child.stdout.on('data', (part: Buffer) => {
      size += part.length
      if (size > 8 * 1024 * 1024)
        fail(new Error('A resposta do motor excedeu o limite.'))
      else chunks.push(part)
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      if (failed) return
      if (code !== 0) {
        reject(new Error('O motor não conseguiu concluir a operação.'))
        return
      }
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    child.stdin.on('error', () => undefined)
    child.stdin.end(input || '')
  })
}
