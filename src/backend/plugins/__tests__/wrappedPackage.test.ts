import { join } from 'path'
import { selectWrappedPackage } from '../wrappedPackage'

const root = join(process.cwd(), 'fixture')
it('selects the Stonewards game archive and leaves Fix Repair out of automatic extraction', () => {
  const game = join(root, 'Stonewards', 'Stonewards.v0.1.5-OFME.rar')
  expect(
    selectWrappedPackage(
      [
        game,
        join(
          root,
          'Stonewards',
          'Fix Repair',
          'Stonewards_Fix_Repair_Steam_Generic.rar'
        )
      ],
      root,
      true
    )
  ).toBe(game)
})
it('rejects multiple main archives instead of guessing from file size', () => {
  expect(() =>
    selectWrappedPackage([join(root, 'a.rar'), join(root, 'b.rar')], root, true)
  ).toThrow('mais de um')
})
it('keeps multipart siblings out of the main package count', () => {
  const first = join(root, 'Game.part01.rar')
  expect(
    selectWrappedPackage([first, join(root, 'Game.part02.rar')], root, true)
  ).toBe(first)
})
it('does not mistake a repair-only torrent for the game', () => {
  expect(() =>
    selectWrappedPackage([join(root, 'Fix Repair', 'patch.rar')], root, true)
  ).toThrow('Nenhum pacote principal')
})
it('does not apply the Online-Fix convention to unrelated sources', () => {
  expect(() =>
    selectWrappedPackage(
      [join(root, 'Game.zip'), join(root, 'Fix Repair', 'patch.rar')],
      root,
      false
    )
  ).toThrow('mais de um')
})
