# Custom Rules & Active Reminders

## Central Skills & Chronic Error Protocol (`C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher`)
- **Pre-Implementation Consultation**: Before creating, refactoring, or modifying ANY feature, UI element, or backend logic, ALWAYS consult the skills directory `C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher\` (specifically `regras.md`, `erros_corrigidos.md`, `conquistas_e_solucoes.md`, `sistema_update.md`, `sistema_scaneamento.md`, `designer_interface.md`, `relatorios_bugs.md`) to verify that no existing rules, design preferences, or chronic bug prevention patterns are violated.
- **Feedback & Rejection Recording Protocol**: If the user does NOT approve a layout edit, feature, or code change (either by personal taste or due to a defect/bug), ALWAYS ask the user the exact rationale, and immediately document the user's preferences into `designer_interface.md`, `regras.md`, or `erros_corrigidos.md` so that the exact mistake is NEVER repeated.
- **Success & Victories Log (`conquistas_e_solucoes.md`)**: Whenever a feature, UI design, or architectural solution is functional, well-built, and approved, immediately document it into `conquistas_e_solucoes.md` to celebrate and preserve successful implementation patterns.
- **Continuous Knowledge Feeding**: Every time a new technology is implemented, a bug is fixed, a new rule is established, or a design guideline is applied, ALWAYS update/feed the corresponding `.md` file in `C:\Users\alazt\Documents\GitHub\Skills\Ghost Games Launcher\`.

## Release Publishing Pattern
- **Title Format**: Always title releases as `👻 Ghost v[Version]` (e.g., `👻 Ghost v0.1.4-beta`).
- **Release Description Header**: Right under the header `## Notas de Lançamento da Versão v...` in the release body description, always insert this exact HTML image:
  `<img width="192" height="191" alt="notas da atualização oficial" src="https://github.com/user-attachments/assets/17ab8642-b2fa-4c17-a76e-2573d38b5586" />`
- **Version Auto-Detection**: Always verify the last published version via git tags/GitHub releases, and increment it logically (e.g., bump patch version like 0.1.3 -> 0.1.4) to determine the next release version.

## Releases.com Left Sidebar Expansion
- **Permanent Solution Guide**: When modifying or fixing the left sidebar on the Releases screen (`src/frontend/screens/Releases/index.tsx`), ALWAYS refer to [docs/RELEASES_SIDEBAR_GUIDE.md](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/docs/RELEASES_SIDEBAR_GUIDE.md). Apply the exact comprehensive selectors (`aside, nav, div[class*="sidebar"], div[class*="Sidebar"], div[class*="menu"], div[class*="Menu"], div[class*="left-nav"], div[class*="LeftNav"]`) with `280px` width, and unclip internal text via `white-space: nowrap !important; word-break: keep-all !important; text-overflow: clip !important; overflow: visible !important;`. NEVER use `querySelectorAll('*')` on left sidebar children.

## Próximos Afazeres Prioritários
1. **Plano e Implementação de Jogos da Steam no Ghost**: Estruturar arquitetura de detecção, metadados, capas e lançamento de jogos Steam dentro do Ghost.
