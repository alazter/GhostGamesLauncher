# DRM: consulta geral e acesso solicitado às fontes

Solicitação inicial: usar o fluxo adicional ao clicar em **Verificar DRM**, mantendo o restante do Ghost como está. Em 17/10/2026, o usuário também autorizou experimentar a liberação humana ao clicar em uma fonte nos detalhes. Esse acesso explícito foi validado para HizSearch e SkidrowReloaded; ver [edição manual e teste real](DRM_MANUAL_STATUS.md).

## Comportamento

- O botão permanece à direita do cabeçalho, junto de Expandir calendário. A fila inclui os jogos carregados e monitorados, sem duplicar ocorrências, e permite interromper os próximos pedidos.
- Consultas automáticas e Atualizar status do DRM, nos detalhes, mantêm os caminhos existentes. A fila geral envia o modo explícito `manual: 'general'`, sempre com atualização forçada. O clique em HizSearch ou SkidrowReloaded usa uma ação separada, abre a janela de acesso e renova somente aquela fonte.
- AnkerGames usa primeiro a consulta normal. Em caso de falha, o modo geral pode recorrer ao Scrapling com navegador, sessão própria, Chrome instalado, limite de tempo e proxy restrito com DNS do Ghost. Respeita o motor habilitado nas preferências; não ativa o Obscura nem instala navegadores durante a consulta.
- SkidrowReloaded também pode usar uma sessão Electron isolada no modo geral quando a consulta comum falha. Limites HTTP 429 respeitam o prazo de espera e não iniciam fallback. Ver o [caso Boltgun 2](DRM_BOLTGUN_2.md) para o formato de anúncio e as restrições observadas no acesso real.
- HizSearch usa o formulário da própria página, dentro de uma sessão exclusiva `persist:ghost-drm-hiz`. Se o campo estiver bloqueado, a fonte informa verificação pendente e as demais consultas continuam.
- **Liberar acesso ao HizSearch** aparece depois dessa necessidade ser identificada durante uma consulta geral. A janela é exibida ao clicar nessa opção ou no link da fonte nos detalhes. O usuário pode completar a verificação humana ou fechar a janela. A liberação tem espera limitada e não impede a fila das demais fontes.
- Após a liberação, o Ghost repete somente o HizSearch para o lote original, preservando as outras fontes e suas datas. Não refaz as consultas já realizadas ao Reddit, à planilha, ao AnkerGames ou às demais fontes nessa etapa.
- A janela de consulta é encerrada ao terminar o lote; dados persistentes da sessão permanecem no perfil próprio. Cookies, tokens e chaves de API não são exportados. Pop-ups, downloads e permissões da página são bloqueados.
- Listar um título não confirma quebra de DRM. Somente evidência explícita pode confirmar o status. Quebra ou ausência de DRM confirmadas continuam sendo salvas, encerrando consultas automáticas; jogos sem quebra seguem sendo verificados.
- A edição manual é independente da evidência das fontes e permanece até **Voltar ao automático**. O teste de acesso interativo ao AnkerGames permaneceu limitado por HTTP 429 e não entrou no produto; seu link continua externo.

## Continuidade quando uma fonte fica indisponível — 17/10/2026

O Ghost preserva também a última listagem válida de cada fonte quando há falha de acesso, manutenção, limite temporário ou verificação pendente. Mantém `observedAt`, título e URL originais e mostra **Último resultado válido preservado** junto da restrição atual. Uma listagem continua sem representar quebra de DRM. Uma resposta válida mais recente pode atualizar a fonte e um novo status explícito pode revisar o anterior.

O fluxo geral e a repetição exclusiva do HizSearch conservam a necessidade atual de verificação; o uso de dados salvos não oculta o botão para liberar o acesso. A preservação usa o cache persistente existente: até 500 relatórios no cache rotativo e arquivos separados para confirmações finais. Não existe informação offline de um jogo que nunca tenha sido consultado com sucesso; listagens do cache rotativo também podem ser removidas por sua política de capacidade.

`lastAttemptAt` registra a tentativa de consulta separadamente de `checkedAt`/`observedAt`, que podem apontar para evidência anterior. O intervalo de 15 minutos para consultas automáticas considera a última tentativa, evitando repetições constantes quando o resultado anterior está preservado. Consultas manuais continuam podendo renovar os dados, respeitando os prazos de espera das fontes.

Isso mantém os resultados já conhecidos disponíveis durante falhas; não garante acesso novo e contínuo aos três sites. O proprietário controla os limites de requisições ([Cloudflare 1015](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1015/)) e a duração da liberação por desafio ([clearance](https://developers.cloudflare.com/cloudflare-challenges/concepts/clearance/)). Não se deve aumentar a frequência de pedidos para tentar liberar um site: isso pode prolongar o bloqueio.

## Pacote do motor

Scrapling 0.4.15, integração 2, acrescenta a operação restrita `manual-drm-page-v1` sem mudar as operações de parsing existentes. Pacote verificado por SHA-256:

`184012ed21129c351ffef97cc780b32a9c2032a88940f48d8846bd5d97a0c3d5`

O empacotamento inclui as dependências opcionais dos fetchers, os arquivos de fingerprints e os componentes de automação. Não contém o perfil pessoal do Chrome. O pipeline instala `scrapling[fetchers]`, valida o executável e mantém o catálogo aprovado. Um motor antigo ou desativado resulta em aviso na fonte, preservando a consulta pelas demais fontes.

Chromium precisa receber HTTP 407 com Proxy-Authenticate antes de enviar credenciais ao CONNECT. O proxy agora responde a esse desafio sem resolver o destino de pedidos não autenticados; as verificações de domínio, porta e endereço público permanecem aplicadas após autenticação.

## Validação em 08/10/2026

- 82 testes de Lançamentos aprovados em 16 suítes, incluindo exclusividade do fluxo geral, persistência, limites da fila, interrupção e repetição exclusiva do HizSearch.
- 22 testes dos motores, política e proxy aprovados em três suítes. Teste de proxy confirma HTTP 407 sem consulta DNS antes da autenticação.
- TypeScript sem erros e validação da interface nas larguras 1500, 1100, 900 e 650. Quatro jogos únicos, incluindo um monitorado fora da página; atualização individual continua sem ativar o modo novo.
- Executável Scrapling instalado em perfil temporário separado: operação original de parsing aprovada; consulta real ao AnkerGames retornou Minecraft Dungeons II. Resultado registrado como **listado / status não confirmado**, pois não havia evidência explícita de quebra.
- HizSearch real retornou verificação pendente. Em uma página de teste controlada, a abertura da janela, liberação do campo, consulta e leitura do título funcionaram, sem transformar listagem em confirmação de DRM. O CAPTCHA real depende da interação do usuário; não foi declarado resolvido pelo teste controlado.
- A pasta inicial do teste tinha um caminho excessivamente longo para uma DLL do Windows. A repetição usou perfil temporário curto e passou; o perfil real do Ghost e suas contas não foram alterados.

Artefatos: `.system_generated/tasks/drm-manual/runtime-result.json`, `ui-result.json`, `hiz-dom-schema.json` e capturas da interface. Perfis e executáveis de depuração não fazem parte dos registros versionáveis.

A remoção dos perfis temporários e do executável de depuração foi bloqueada pela política automática do ambiente. Esses arquivos foram preservados e excluídos dos registros versionáveis; não são perfis pessoais do usuário.

Validação da continuidade: 76 testes de DRM em 13 suítes, checagem TypeScript, lint do módulo novo e compilação completa aprovados. O teste de persistência mantém a listagem original após uma falha no dia seguinte e reinício, sem repetir a consulta antes do intervalo. São testes de continuidade de dados, não prova de liberação de CAPTCHA ou acesso online permanente. Alteração no código/build local; não atualiza automaticamente um executável já empacotado em outra pasta.
