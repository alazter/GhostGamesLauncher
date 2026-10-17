import type { ReleaseDrmSource } from 'common/releaseDrm'

const hasEvidence = (source: ReleaseDrmSource) =>
  !!((source.status && source.status !== 'unknown') || source.protection)
const hasListing = (source: ReleaseDrmSource) =>
  hasEvidence(source) || source.availability === 'listed'
const unavailable = (source: ReleaseDrmSource) =>
  source.requiresVerification ||
  /indisponível|manutenção|verificação|expirou|limite temporário|restringiu|não forneceu/i.test(
    source.notice || ''
  )

/** Keep dated source evidence usable offline, together with the current access warning. */
export function preserveDrmSources(
  current: ReleaseDrmSource[],
  previous: ReleaseDrmSource[]
) {
  const preserved: ReleaseDrmSource[] = []
  for (const source of previous) {
    if (!hasListing(source)) continue
    const replacements = current.filter((item) => item.name === source.name)
    if (replacements.some(hasEvidence)) continue
    // A fresh listing replaces an older listing. Fresh ambiguity does not erase
    // explicit DRM evidence; only another explicit status can revise it.
    if (
      !hasEvidence(source) &&
      (replacements.some(hasListing) ||
        (replacements.length > 0 && !replacements.some(unavailable)))
    )
      continue
    const failure = replacements.find(unavailable)
    preserved.push({
      ...source,
      notice: failure
        ? `Último resultado válido preservado. ${failure.notice || 'A fonte exige verificação de acesso.'}`.slice(
            0,
            1000
          )
        : source.notice,
      ...(failure ? { requiresVerification: failure.requiresVerification } : {})
    })
  }
  return {
    sources: preserved.length
      ? [
          ...current.filter(
            (source) => !preserved.some((old) => old.name === source.name)
          ),
          ...preserved
        ].slice(0, 24)
      : current,
    preserved: preserved.length > 0
  }
}
