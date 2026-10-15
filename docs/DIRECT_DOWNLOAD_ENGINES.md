# Scrapling e Obscura nos downloads diretos

## Cobertura

| Fonte nativa | Catálogo | Torrent | Download direto |
| --- | --- | --- | --- |
| AnkerGames | Scrapling + fallback Obscura | Fluxo específico da fonte | Leitor compartilhado + sessão Electron |
| SteamRIP | Scrapling + fallback Obscura | Quando oferecido pela integração | Leitor compartilhado + sessão Electron |
| Online-Fix | Scrapling + fallback Obscura | Scrapling + Obscura na página pública; sessão nos uploads | Leitura de links/pacotes + sessão Electron; jogo e fix |
| NXBrew, NSWGF, RomsLab | Scrapling + fallback Obscura | Não habilitado nesta opção | Mesmo leitor e controlador de Anker/SteamRIP |

O catálogo já consultava os motores nas seis fontes. Online-Fix também tinha
uma operação para localizar torrents. O download direto agora possui um leitor
compartilhado, `DirectPageEngines`, usado por `BrowserDownloadAutomation` e
`OnlineFixDirect` quando os controles nativos não conseguem prosseguir.

## Sequência e limites

1. As instruções aprendidas e os controles conhecidos continuam sendo o caminho
   inicial. Desafios interativos continuam na confirmação manual.
2. No fallback, um snapshot do DOM atual remove scripts, iframes, inputs,
   metadados e atributos de formulário/eventos. O HTML tem limite de 2 MiB.
3. Scrapling recebe `direct-download-page-v1` e devolve apenas âncoras e
   metadados `data-links`, até 200 de cada. Textos alternativos de imagens,
   títulos e rótulos de acessibilidade permitem reconhecer controles sem texto
   convencional. A operação não faz requisições nem grava URLs assinadas.
4. Sem resultados úteis, Obscura pode renderizar a página pública do jogo na
   origem cadastrada. Não recebe cookies, login ou corpos de formulário do
   Electron. Não renderiza diretórios autenticados de hosters, uploads,
   intermediários `/download`, subdomínios de serviço ou URLs com query. O proxy
   fica restrito aos domínios da fonte e à verificação já utilizada.
5. Ghost revalida os destinos pelo manifesto, HTTPS, rótulo de download e
   exclusão de report/abuse, anúncios e torrents. Em um hoster, só navega para
   um único arquivo compatível; Online-Fix exige o nome exato do pacote.
   Formulários POST continuam nos controles nativos da mesma sessão,
   preservando CSRF, referrer e popups legítimos.
6. Entradas de pacotes passam pelo mesmo validador Online-Fix: nomes seguros,
   hosters permitidos, jogo + fix, volumes contíguos e sem combinação de edições.
   Extração, instalação e senha `online-fix.me` ficam no instalador existente.

O leitor é assíncrono e não segura o watchdog. Enquanto a consulta está
pendente, o card mantém o prazo automático, até 45s. Depois, abre a confirmação
manual pelo prazo existente de 120s. Resultados após cancelamento, retorno ao
jogo ou navegação são descartados; uma consulta cancelada não inicia um novo
fallback Obscura. Os motores são opcionais e usados somente se instalados e
habilitados; esta integração não altera essas preferências.

O aprendizado manual continua compartilhado no Ghost, antes do fallback. Uma
receita só é persistida após recebimento válido e preparação bem-sucedida.
Não há novo banco de cookies/senhas no Scrapling nem reconhecimento universal de
hosters desconhecidos. Plugins de terceiros não entram automaticamente.

## Pacote e distribuição

Scrapling 0.4.15, revisão de integração **4**, declara a capability
`direct-download-page-v1`. O smoke test recusa ativar um pacote revisão 4 sem
ela. Workers antigos são tolerados, sem interpretar resultados de catálogo
como downloads ou desativar uma instalação saudável.

Pacote local recompilado e verificado, SHA-256:
`0d1cb3a2bd35fbb6c01cbe552386ddf55042ddc071deeb51e847b6f572e90a3c`.
`public/engine-bundles` é ignorado pelo Git; o workflow gera os recursos para
distribuição e inclui os módulos de download direto no fingerprint.
Nenhuma publicação remota foi realizada nesta alteração.

Foi corrigida a indentação do self-test Python após os filtros de cards
institucionais, preservando esses filtros e as operações anteriores.

## Verificação

- Worker Python e executável empacotado: self-test com capability nova.
- Obscura empacotado: DOM/JavaScript controlado e digest oficial conferidos.
- Electron com worker real e perfil temporário: cinco fontes pelo controlador
  compartilhado e Online-Fix com jogo + fix, **sete arquivos ZIP recebidos**,
  **zero janelas reveladas**, **14 snapshots sanitizados**. As páginas usavam
  imagens/rótulos alternativos para provocar o fallback de leitura.
- Testes das seis fontes nos dois leitores, worker antigo, limites, links
  indevidos, nomes de arquivo, pacotes incompletos, resultados tardios e prazo
  manual mesmo quando o motor permanece pendente.
- Verificação final: **235 testes em 12 suítes**, TypeScript, lint dos quatro
  módulos diretos sem erros/avisos e build isolado aprovados. O smoke Electron
  adicional confirmou o protocolo de downloads do executável Scrapling e a
  navegação HTML do Obscura através do proxy restrito.

Logs em `.system_generated/tasks/direct-engines/`: `native-all-sources.log`,
`worker-selftest.log`, `regression-final.log`, `types-final.log`,
`lint-final.json` e `app-build.log`.
São arquivos/páginas controlados; não representam instalação completa de jogos
reais de todos os hosters.
