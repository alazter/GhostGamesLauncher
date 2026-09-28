import { externalErrorMessage } from 'common/externalErrors'

it.each([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ENOSPC',
  'EBUSY',
  'EEXIST',
  'ENOTDIR',
  'ECONNRESET',
  'ETIMEDOUT'
])('translates system error %s without leaking raw paths', (code) => {
  const result = externalErrorMessage({
    code,
    message: `${code}: English error at PRIVATE_PATH`
  })
  expect(result).not.toContain(code)
  expect(result).not.toContain('PRIVATE_PATH')
})
it('translates persisted raw errors and preserves Portuguese application messages', () => {
  expect(
    externalErrorMessage("ENOENT: no such file or directory, lstat 'private'")
  ).toContain('não foi encontrado')
  expect(externalErrorMessage('fetch failed')).toContain('conectar ao servidor')
  expect(externalErrorMessage('Selecione um executável válido.')).toBe(
    'Selecione um executável válido.'
  )
})
