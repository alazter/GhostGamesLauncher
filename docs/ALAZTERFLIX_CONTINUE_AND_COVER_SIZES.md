# Continuação e tamanho das capas por página

Implementação de 11/10/2026, provedor Alazterflix 1.3.2 e frontend Ghost.

## Continue de onde parou

A lista permanece exclusiva de Para você. Em repouso exibe três vídeos;
Ver todos exibe todos os itens com progresso real e não assistidos, sem o
limite anterior de dez, e revela Limpar lista. Mostrar menos recolhe novamente.

Limpar lista chama um IPC dedicado e o método opcional clearContinueWatching
do provedor. Provedores antigos retornam uma mensagem de atualização necessária.
A escrita usa a fila da biblioteca e marca continueHidden no histórico, por
ID e caminho, apenas para vídeos em andamento. Não zera o progresso nem altera
o status assistido, notas, arquivos ou metadados. A marca persiste no
armazenamento do plugin; saveProgress cria um registro atualizado sem a marca,
fazendo o vídeo voltar à lista após reprodução nova. Limpezas repetidas são
idempotentes. A interface desabilita o botão enquanto aguarda a confirmação,
mantém a lista se a operação falhar e só a remove após sucesso do provedor.

## Tamanho por página

ghost_alazterflix_cover_sizes guarda um mapa com preferências independentes
para all, forYou, anime, series, movie, documentary, cartoon e stremio.
Cada valor é inteiro de 0 a 4. A preferência antiga ghost_alazterflix_cover_size
serve como valor inicial para páginas ainda não configuradas; se ausente ou
inválida, o padrão é Médias (2). Zero é preservado como tamanho válido.

Trocar de página deriva imediatamente o tamanho do mapa, evitando aplicar
temporariamente o tamanho da aba anterior. Cada alteração grava o mapa e
sincroniza o backup. As listas permitidas do frontend e backend incluem as
chaves nova e antiga. storage e heroicSettingsChanged recarregam preferências
após alterações externas ou restauração. O tamanho da Library de jogos não
foi alterado.

## Validação

43 testes em quatro suítes: catálogo, normalização dos tamanhos, plugin real
no sandbox e limite de backup. Incluem limpeza de mais de dez entradas,
histórico legado por caminho, idempotência, retomada, preservação de registros
assistidos e dos dados dos vídeos, tamanhos inválidos e valor zero.

AlazterflixScreen real em Electron com serviços e vídeos simulados: sete abas
com tamanhos distintos, recarga, restauração e envio do backup; lista completa
com 14 entradas, botão apenas na lista expandida, falha sem perda da lista,
limpeza persistente e retorno após nova reprodução. Desktop e 390 px, sem
overflow horizontal ou erros de página. TypeScript, lint dos módulos pequenos
modificados e compilação passaram. Pacote 1.3.2 conferido por extração e checksum.
Evidências: .system_generated/tasks/alazterflix-page-preferences. A validação
não executou Limpar lista nem reproduziu vídeos no perfil pessoal do usuário.
