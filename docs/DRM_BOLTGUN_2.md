# DRM de Boltgun 2 — 17/10/2026

Caso relatado: as páginas de SkidrowReloaded, AnkerGames e HizSearch já apresentavam Warhammer 40,000: Boltgun 2, mas o Ghost não obtinha um resultado útil.

## Diagnóstico e correção

A página pública [Warhammer 40000 Boltgun 2-RUNE](https://www.skidrowreloaded.com/warhammer-40000-boltgun-2-rune/) respondeu HTTP 200 na consulta inicial e foi salva como evidência local. Usa um `h2` e um contêiner WordPress `post-extended`, com marcação de classe malformada. O leitor anterior exigia `h1` e metadados/NFO explícitos, por isso descartava a publicação. A busca pública também encontrou o endereço correto.

O leitor passa a reconhecer esse formato como anúncio de lançamento: exige URL canônica correspondente, título completo com grupo conhecido, categoria PC GAMES, data de publicação válida, metadados do mesmo jogo, data de lançamento válida e repetição do nome do release junto de seu tamanho. Updates, repacks, DLCs, demonstrações e bypasses não entram nessa confirmação. Nome do grupo isolado, comentários, links ou outra edição continuam insuficientes.

Com a página real obtida, o resultado validado é **quebra relatada**, grupo **RUNE**, anúncio publicado em **17/10/2026**. Isso registra o relato da fonte; não identifica automaticamente a proteção nem inventa uma data técnica da quebra. A comparação usa o título completo, inclusive o número da sequência.

`drmGameSlug` agora remove separadores de milhar: `Warhammer 40,000: Boltgun 2` produz `warhammer-40000-boltgun-2`, em vez de um caminho com `40-000`. A busca do HizSearch também pode ser aberta com o parâmetro público `q`. Chaves e caminhos de API continuam fora dos links de fonte.

HTTP 429 e páginas de limite temporário são tratados como indisponibilidade. O leitor respeita `Retry-After` e não inicia o fallback de navegador durante esse período. A versão de consulta é 6, renovando resultados anteriores não confirmados; confirmações persistentes continuam preservadas.

Na ação geral **Verificar DRM**, SkidrowReloaded ganha um fallback de página pública em sessão Electron isolada, com janela oculta, limite de tempo e consultas serializadas. Restringe domínios, permissões, downloads e popups. Esse fluxo não é executado nas consultas automáticas. O fallback não resolve CAPTCHA nem garante acesso: no primeiro teste ao vivo, a busca permaneceu indisponível/exigindo verificação. O teste posterior com participação do usuário está registrado abaixo.

## Resultado de acesso inicial observado

| Fonte | Evidência e limite |
| --- | --- |
| SkidrowReloaded | Anúncio e busca obtidos inicialmente com HTTP 200; parser corrigido reconheceu a página real salva. A consulta seguinte por Electron recebeu HTTP 403/Just a moment, e o fallback de navegador também não liberou a busca. Não declarar o fluxo ao vivo liberado por causa do teste com o HTML já obtido. |
| AnkerGames | [Página pública existente](https://ankergames.net/game/warhammer-40000-boltgun-2), marcada Own CSF na leitura web. A conexão local recebeu HTTP 429/Cloudflare 1015. Esse resultado exige aguardar; não confirma status de DRM. |
| HizSearch | [Página de consulta](https://hizsearch.pages.dev/?q=boltgun%202) carregou, mas o campo `game-search-input` estava desativado e havia verificação humana. O botão existente **Liberar acesso ao HizSearch** permite ao usuário concluí-la e repetir somente essa fonte. Não foi declarada uma pesquisa real concluída. |

Nenhum jogo foi baixado. Perfis de teste isolados, sem alterar biblioteca, contas ou histórico de DRM do usuário. Não foi introduzida uma exceção de título nem um status fixo para Boltgun 2 no código de produção.

## Verificação

68 testes de DRM em 12 suítes passaram. Incluem o formato WordPress real, metadados ausentes/alterados, outro jogo, categoria indevida, datas futuras, slug correto, links públicos do HizSearch, escopo manual do fallback, fechamento de janelas, timeout, bloqueio de redirecionamento e espera após HTTP 429.

Evidências ignoradas pelo Git em `.system_generated/tasks/boltgun-drm/`: HTML inicial, respostas de acesso, `verified-snapshot-result.json` e logs de compilação. Resultados de fixtures e HTML salvo não devem ser apresentados como liberação atual de serviços externos. Naquela etapa, a validação do usuário ainda estava pendente.

## Teste posterior com participação do usuário — 17/10/2026

O usuário autorizou testar o clique na fonte para completar a verificação e implementar a edição manual. A primeira janela não apareceu; após centralização, título estável e abertura em primeiro plano, respondeu **“Apareceu e concluí”**. O fluxo final, usando o backend de produção em perfil isolado, retornou o título correspondente no HizSearch e leu o anúncio RUNE no SkidrowReloaded. Portanto, nesta execução houve acesso real, além dos testes anteriores com HTML salvo. HizSearch permaneceu apenas **listado**, enquanto SkidrowReloaded informou **quebra relatada / RUNE**.

A escolha manual persistiu durante as consultas; ao removê-la, o resultado automático foi `cracked`. Não foi gravada exceção para Boltgun 2 no perfil pessoal. O acesso interativo foi mantido somente para HizSearch e SkidrowReloaded; AnkerGames continuou limitado por HTTP 429/Cloudflare 1015. Novas restrições ainda podem exigir verificação ou espera. Detalhes, persistência e 84 testes atuais: [DRM_MANUAL_STATUS.md](DRM_MANUAL_STATUS.md). Aprovação da funcionalidade completa permanece pendente.
