# Custom Rules & Active Reminders

## Startup Performance Optimization (Covers)
- **Reminder**: When starting a new session or receiving new requests from the user, remind the user about creating an implementation plan to optimize the startup loading of game cover art. Currently, the launcher takes about 10 seconds to load covers upon start, and we want to optimize/parallelize this process.

## Release Publishing Pattern
- **Title Format**: Always title releases as `👻 Ghost v[Version]` (e.g., `👻 Ghost v0.1.4-beta`).
- **Release Description Header**: Right under the header `## Notas de Lançamento da Versão v...` in the release body description, always insert this exact HTML image:
  `<img width="192" height="191" alt="notas da atualização oficial" src="https://github.com/user-attachments/assets/17ab8642-b2fa-4c17-a76e-2573d38b5586" />`
- **Version Auto-Detection**: Always verify the last published version via git tags/GitHub releases, and increment it logically (e.g., bump patch version like 0.1.3 -> 0.1.4) to determine the next release version.

## Releases.com Left Sidebar Expansion
- **Permanent Solution Guide**: When modifying or fixing the left sidebar on the Releases screen (`src/frontend/screens/Releases/index.tsx`), ALWAYS refer to [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md). Apply the exact comprehensive selectors (`aside, nav, div[class*="sidebar"], div[class*="Sidebar"], div[class*="menu"], div[class*="Menu"], div[class*="left-nav"], div[class*="LeftNav"]`) with `280px` width, and unclip internal text via `white-space: nowrap !important; word-break: keep-all !important; text-overflow: clip !important; overflow: visible !important;`. NEVER use `querySelectorAll('*')` on left sidebar children.
