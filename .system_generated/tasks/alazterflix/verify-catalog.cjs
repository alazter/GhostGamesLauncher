const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ts = require('typescript')
const Module = require('module')
const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v))
const sourcePath = path.join(process.env.APPDATA, 'ghost/plugins_data/com.ghost.alazterflix.json')
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const storage = clone(source)
let provider
const context = vm.createContext({ Buffer, URL, URLSearchParams, setTimeout, clearTimeout, Date, ghost: { log() {}, warn() {}, error() {}, storage: { get: async (key) => clone(storage[key]), set: async (key, value) => { storage[key] = clone(value) } }, ui: { injectCSS() {} }, http: { fetch: async () => { throw new Error('Catalog audit must never access the network') } }, media: { registerMediaProvider: (p) => { provider = p }, artworkExists: async (file) => fs.existsSync(file) } } })
vm.runInContext(fs.readFileSync('plugins/alazterflix/index.js', 'utf8'), context)
const filename = path.resolve('src/common/mediaCatalog.ts')
const compiled = new Module(filename, module)
compiled.paths = Module._nodeModulePaths(path.dirname(filename))
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename)
async function main() {
  const state = await provider.getState()
  const original = new Map(source.movies.map((m) => [m.filePath, m]))
  const historical = new Map((source.catalog_v2_backup?.movies || source.movies).map((m) => [m.filePath, m]))
  const shows = compiled.exports.groupMoviesIntoShows(state.movies)
  const historicChanges = state.movies.filter((m) => historical.get(m.filePath)?.title !== m.title)
  const report = {
    checkedAt: new Date().toISOString(), files: state.movies.length,
    uniqueIdsBefore: new Set((source.catalog_v2_backup?.movies || source.movies).map((m) => m.id)).size,
    uniqueIdsAfter: new Set(state.movies.map((m) => m.id)).size,
    pathsPreserved: state.movies.every((m) => original.has(m.filePath)),
    titlesPreservedByCurrentImplementation: state.movies.every((m) => original.get(m.filePath)?.title === m.title),
    titlesChangedSinceBackupByManualEdits: historicChanges.filter((m) => m.customTitle === m.title).length,
    titlesChangedSinceBackupWithoutManualEdits: historicChanges.filter((m) => m.customTitle !== m.title).length,
    coversPreserved: state.movies.every((m) => original.get(m.filePath)?.localCoverPath === m.localCoverPath),
    missingLocalCovers: state.movies.filter((m) => m.artworkMissing || !m.localCoverPath).length,
    missingVideoFiles: state.movies.filter((m) => !fs.existsSync(m.filePath)).length,
    recoverySnapshot: Boolean(storage.catalog_v2_backup),
    works: shows.length,
    worksByCategory: Object.fromEntries(['movie', 'series', 'anime', 'cartoon', 'documentary'].map((cat) => [cat, shows.filter((s) => s.mediaCategory === cat).length])),
    tmdbConfigured: state.metadataSettings.tmdbConfigured,
    verifiedPortugueseCovers: shows.filter((s) => s.sampleMovie.artworkLanguage === 'pt').length,
    note: 'Read-only audit. Existing local artwork language is unknown unless explicitly verified by the provider or chosen manually.'
  }
  fs.writeFileSync(path.join(__dirname, 'catalog-audit.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.pathsPreserved || !report.titlesPreservedByCurrentImplementation || report.titlesChangedSinceBackupWithoutManualEdits || report.uniqueIdsAfter !== report.files || report.missingLocalCovers) process.exitCode = 1
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
