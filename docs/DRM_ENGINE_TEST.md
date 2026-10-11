# Teste de acesso ao AnkerGames e HizSearch

Data: 05/10/2026, America/Sao_Paulo.

O Scrapling completo abriu a página pública do AnkerGames. Nenhum dos motores liberou a pesquisa do HizSearch nas condições testadas. Este é um teste isolado, sem ativação ou alteração dos motores na instalação do Ghost.

| Motor                                    | AnkerGames                                     | HizSearch                                                |
| ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| Scrapling 0.4.15, Chrome 145.0.7632.160  | Conteúdo do jogo confirmado em duas consultas  | Verificação continua presente; campo de busca desativado |
| Obscura 0.2.3, pacote existente do Ghost | Tela de verificação nos modos normal e stealth | Verificação continua presente nos dois modos             |

## Condições e evidências

- Dez carregamentos públicos: seis pelo Obscura e quatro pelo Scrapling, somente nos sites solicitados. Não foi iniciado download de jogo nem usado login pessoal.
- Página AnkerGames: `https://ankergames.net/game/minecraft-dungeons-ii`. O Scrapling retornou HTTP 200, título completo Minecraft Dungeons II e conteúdo do jogo em aproximadamente 16,1 segundos. Uma nova execução com o mesmo perfil temporário retornou novamente o conteúdo em 17,5 segundos. O registro do Scrapling informou que não encontrou um desafio nessa página; portanto, o resultado comprova acesso pelo navegador utilizado, não a resolução de um CAPTCHA do AnkerGames.
- O Obscura ficou com o título Just a moment e sem o título/conteúdo do jogo, nos modos normal e stealth. A repetição em stealth com 25 segundos adicionais de espera e o mesmo armazenamento temporário também permaneceu nessa tela. A mensagem de verificação concluída não bastou para abrir o conteúdo.
- Página HizSearch: `https://hizsearch.pages.dev/`. O Scrapling renderizou a aplicação e informou que o desafio embedded estava resolvido. A captura visual continuou mostrando Confirme que é humano. Na segunda execução, aguardando a estabilidade da rede, o campo de texto estava visível e desativado, e o navegador ainda continha um frame challenges.cloudflare.com. A pesquisa não pôde ser realizada. HTTP 200 e a mensagem do coletor não comprovam liberação do acesso.
- O Obscura não disponibilizou a busca do HizSearch, inclusive na repetição com maior espera. Não se conclui que toda versão futura dos motores falhará; os resultados correspondem às versões, navegador e conexão deste teste.
- Perfis temporários próprios, sem leitura ou transferência de cookies das contas do usuário. Nenhuma chave de API do site foi extraída ou utilizada diretamente. O código normal das páginas executou no navegador. Cabeçalhos, cookies e tokens não fazem parte do relatório; caminhos dinâmicos de desafio foram removidos dos registros.

## Consequência para a integração

No teste inicial de 05/10, o Scrapling era apenas um candidato para leitura complementar do AnkerGames, e o Ghost ainda utilizava exclusivamente seu parser. A integração posterior foi limitada ao botão geral Verificar DRM, conforme solicitado pelo usuário; veja [DRM_MANUAL.md](DRM_MANUAL.md). O HizSearch continua exigindo verificação humana quando a busca estiver bloqueada. A validação confere o conteúdo esperado e a disponibilidade da busca, preservando o resultado anterior ao encontrar uma tela de desafio.

Perfis de navegação do teste foram removidos ao terminar. O ambiente Python de teste permanece isolado na pasta de artefatos, ignorado pelo Git, para permitir repetição. Resultados de DRM salvos, preferências do Ghost e contas conectadas não foram alterados.

## Reprodução e registros

- `.system_generated/tasks/drm-engine-test/obscura-test.cjs`: modos normal/stealth e repetição com `--long-wait`.
- `.system_generated/tasks/drm-engine-test/scrapling-test.py` e `scrapling-run.cjs`: navegador completo e segunda execução `wait-and-reuse`.
- `obscura-result.json`, `obscura-long-result.json` e `scrapling-wait-and-reuse-result.json`: metadados do resultado.
- `scrapling-HizSearch-wait-and-reuse.png`: evidência visual da verificação ainda presente.
- `requirements.txt`: versões das dependências no ambiente isolado.

Referências: [Scrapling 0.4.15](https://github.com/D4Vinci/Scrapling/blob/v0.4.15/docs/fetching/stealthy.md), [Obscura 0.2.3](https://github.com/h4ckf0r0day/obscura/releases/tag/v0.2.3). Capacidades anunciadas pelos projetos não substituem a verificação funcional feita acima.
