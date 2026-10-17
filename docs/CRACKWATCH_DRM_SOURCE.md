# Consulta pública do r/CrackWatch

Correção de 16/10/2026. Implementada e testada localmente; avaliação no uso cotidiano pendente.

## Problema reproduzido

O endpoint `search.json` retornou HTTP 403 na conexão local. O leitor anterior compartilhava um bloqueio de uma hora entre a busca e a lista `p9ak4n`: a falha de uma impedia ambas. A busca também examinava somente 25 resultados, incluindo discussões diárias e menções no corpo dos posts. A lista real organiza jogos por categorias de tabelas, enquanto o parser anterior exigia uma coluna explícita de status.

## Implementação

- `drmReddit.ts` consulta as páginas públicas modernas em uma sessão Electron isolada, temporária e sem login. Janela oculta, sandbox, permissões negadas, downloads/popups bloqueados, sem carregar imagens/mídia/fontes ou links externos. Não altera a sessão do usuário.
- Busca com `title:"nome"`, aliases de numerais, exclusão de updates/repacks/discussões e ordenação por novidade. Lê até 100 candidatos presentes na página e verifica até três publicações cujo título corresponda ao jogo base. A primeira página não representa todo o histórico do Reddit.
- A sessão de coleta solicita inglês para preservar os nomes originais: o Reddit traduzia `Crimson.Desert-voices38` para `Crimson.Desert-vozes38`, impedindo a correspondência. Não altera idioma, títulos ou capas da interface do Ghost.
- `drmRedditParser.ts` confere ID, comunidade, permalink, título, classificação e timestamp do post solicitado. Comentários e posts relacionados não constituem evidência. A busca apenas localiza candidatos: a classificação é obtida na página da publicação.
- `Release` e `Denuvo release` podem confirmar uma quebra após correspondência do título. Discussões, repacks, updates, DLCs e outras edições são excluídos. Bypass permanece distinto de quebra; menções a remoção de Denuvo não provam ausência de todo DRM.
- A lista fixada é lida pelo endereço moderno do mesmo post. Somente categorias conhecidas e colunas verificadas geram evidência; a categoria de quebra exige data válida, não futura. O marcador `(HV)` da lista é removido do nome, preservando o status da categoria e a data da quebra. A planilha existente continua sendo consultada separadamente.
- Uma página por vez, intervalo mínimo de 1,2 s entre inícios e prazo de 22 s por página. Memória guarda dados compactos de até 150 páginas, normalmente por 15 min; consultas simultâneas compartilham trabalho. Atualização manual pode renovar páginas, com deduplicação de 10 s e 60 s para a lista compartilhada.
- Falhas ficam em cache por 60 s; HTTP 403 de uma página não bloqueia outras. HTTP 429 pausa novas consultas por no mínimo 60 s e respeita `Retry-After` maior. Não tenta resolver CAPTCHA nem alternar identidades.
- `lookupVersion = 4` renova resultados não confirmados do leitor antigo. Confirmações permanecem no cache persistente existente; consulta manual continua autorizada a revisá-las. Uma indisponibilidade não apaga evidência anterior. A fonte mostra aviso quando falha, e evidência válida é mantida mesmo se outra publicação candidata estiver indisponível.

## Validação

Consulta real com o novo módulo em processo Electron isolado, sem abrir ou encerrar o Ghost do usuário:

| Jogo | Resultado público verificado |
| --- | --- |
| Enshrouded | [Enshrouded-RUNE](https://www.reddit.com/r/CrackWatch/comments/1x6xft4/enshroudedrune/), flair Release, publicado em 15/10/2026 às 20:59 UTC |
| Resident Evil Requiem | [Resident.Evil.Requiem-voices38](https://www.reddit.com/r/CrackWatch/comments/1sh1mjx/residentevilrequiemvoices38/), quebra relatada em 09/04/2026; corroborada pela tabela da lista fixada |
| Crimson Desert | [Crimson.Desert-voices38](https://www.reddit.com/r/CrackWatch/comments/1vewb7g/crimsondesertvoices38/), quebra relatada em 04/08/2026; encontrado após impedir tradução do nome do grupo na coleta |
| DOOM: The Dark Ages | [DOOM.The.Dark.Ages-voices38](https://www.reddit.com/r/CrackWatch/comments/1rsydlr/doomthedarkagesvoices38/), quebra relatada em 13/03/2026 |

As buscas completas levaram aproximadamente 2–3 s por jogo nessas execuções. Isso não é uma garantia de latência em outras conexões.

60 testes DRM em 11 suítes passaram, incluindo parsers, duplicação de consultas, falhas independentes do índice, espera após HTTP 429/Retry-After, timeout e destruição da janela, redirecionamentos, falha parcial e persistência de confirmação originada somente do Reddit após falha e reinício. Os testes usam marcação mínima equivalente à observada nas páginas reais.

## Limites e manutenção

Disponibilidade externa, indexação da busca, edições diferentes, post removido e mudanças de HTML impedem prometer cobertura de 100%. Falha de acesso deve ser apresentada como indisponibilidade, nunca como jogo sem quebra. Divergências entre fontes continuam explícitas.

RSS respondeu durante a investigação, mas não foi adotado como dependência: o [comunicado oficial de outubro do Reddit](https://www.reddit.com/r/modnews/comments/1x6rjnd/mod_monthly_your_october_2026_newsletter_is_here/) anuncia o fim do RSS em 13/11/2026 e alterações na API pública. O leitor público atual também pode exigir manutenção caso o site mude; não substitui eventual integração oficial autorizada.

Não foram modificados os provedores de Releases.com, o calendário anual ou o escopo manual de AnkerGames/HizSearch.
