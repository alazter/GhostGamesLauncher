# Continuidade da reprodução no Alazterflix

Correção de 15/10/2026 para carregamento inesperado durante reprodução contínua.

## Diagnóstico e alteração

O servidor limitava requisições abertas (`Range: bytes=0-` e `bytes=N-`) a
16 MiB por resposta. Um teste com arquivo sintético de 20 MiB confirmou o
encerramento em `16777215` mesmo havendo dados após esse ponto. Isso obrigava
o cliente a obter outro intervalo durante a reprodução.

`mediaByteRange` agora resolve intervalos abertos até o final do arquivo,
mantém intervalos delimitados para seeks e aceita intervalos de sufixo. Limita
o final solicitado ao tamanho real e recusa intervalos inválidos com 416.
A transferência continua usando streams com backpressure e highWaterMark
de 1 MiB; não carrega o arquivo inteiro em memória. HEAD mantém seus cabeçalhos
sem abrir um stream de leitura.

A liberação do stream/FFmpeg acompanha o fechamento da resposta HTTP, em vez
do término da mensagem GET de entrada. O stderr do FFmpeg é consumido para
evitar que o pipe de diagnóstico bloqueie conversões longas. Flags de
sincronização de áudio, cópia de vídeo, busca por keyframe e timestamps de
legendas não foram modificadas.

O indicador era ativado imediatamente em qualquer waiting e dependia de
canplay/playing para sumir. `observeVideoBuffering` exige uma espera contínua
de 400 ms sem avanço e sem dados futuros disponíveis. Esperas curtas não
mostram o overlay; avanço real de frames também limpa o indicador. Uma espera
real continua sendo indicada. Pause, ended, error, troca ou fechamento do vídeo
cancelam os timers; stalled de rede com buffer suficiente não cobre o vídeo.
O observador acompanha a sessão do vídeo, sem ser recriado pelo salvamento
periódico de progresso ou pelas mudanças de volume/metadados.

## Validação

- 27 testes em três suítes: continuidade HTTP, indicador de buffering e
  integração existente do Cinema. Os dois testes de intervalo aberto
  reproduziram o limite de 16 MiB antes da correção e passaram após ela.
- Testes do indicador preservam loading para espera real, verificam ausência
  de flashes em esperas breves, recuperação por timeupdate, pausa/fim/erro,
  eventos waiting repetidos e remoção de listeners/timers.
- AlazterflixScreen real em Electron, serviços do catálogo simulados e servidor
  de mídia real: vídeo sintético de 80 segundos/42.152.334 bytes, H.264 com AAC
  e AC3. Reprodução direta chegou a 52,48 s com dois salvamentos de progresso;
  após trocar para AC3, o novo stream avançou mais 14,14 s. Nenhum novo loading,
  erro de mídia, loadstart inesperado ou término prematuro no trecho observado.
  A reprodução foi acelerada em 2x; não é uma medição de FPS nem uma garantia
  para todos os arquivos, unidades lentas ou fontes remotas.
- TypeScript e lint dos novos módulos/testes passaram.

Evidências locais em `.system_generated/tasks/alazterflix-player-buffering`:
`before.log`, `tests.log`, `playback-result.json`, `types.log`, `lint.log` e
`build.log`. Apenas arquivos sintéticos foram criados/reproduzidos nesse teste
da interface; o perfil, histórico e os vídeos pessoais não foram modificados.
As mudanças são do aplicativo Ghost (frontend e servidor), sem nova versão do
pacote do provedor Alazterflix.
