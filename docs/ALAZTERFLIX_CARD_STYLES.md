# Aparência dos cards do Alazterflix

Implementação do mockup aprovado em 11/10/2026.

## Configuração

Em Configurações → Aparência dos cards, escolha entre **Estilo atual** (padrão preservado), **Informações abaixo** e **Capa limpa**. As mesmas opções aparecem no diálogo de configuração do plugin na página Plugins, com prévias usando uma mídia real da biblioteca. A seleção é salva automaticamente e sincronizada entre os dois acessos.

A capa limpa permite mostrar/ocultar o nome abaixo da imagem, fora do card e sem fundo. O alinhamento pode ser à esquerda, centralizado ou à direita. O tamanho das capas continua disponível; os estilos novos usam largura mínima de 170 px para manter seus controles acessíveis, sem modificar os cards da biblioteca de jogos. Em capas com espaço insuficiente para todos os metadados, o overlay permite rolagem.

## Dados e ações

- O overlay sobe de baixo para cima ao passar o mouse ou focar pelo teclado. No toque, a capa abre o overlay. O painel não muda a altura da grade; no estilo com informações abaixo, substitui o conteúdo do rodapé. No estilo limpo, o nome externo permanece separado do overlay.
- A nota da mídia vem do TMDB. `tmdbRating` guarda a avaliação separada da nota pessoal; `null` registra ausência de avaliação. Dados legados são exibidos apenas quando atribuídos ao TMDB e não editados manualmente. Notas Cinemeta/IMDb não são rotuladas como TMDB; indisponibilidade aparece como “—”. Avaliações ausentes ou zero votos não reutilizam notas de outro provedor. A edição de metadados não permite digitar a nota do TMDB.
- A nota pessoal aceita 0 a 10, incluindo decimais; vírgula é normalizada para ponto. Enter ou saída do campo salva. Um campo vazio remove a nota. Valores inválidos não chegam ao armazenamento; falhas são exibidas no card.
- Estrela alterna favorito, preservando a lista local existente. Check alterna assistido no armazenamento e no histórico por ID/caminho, preservando o ponto de reprodução. Em obras agrupadas, nota pessoal e assistido são aplicados a todos os episódios; em arquivos avulsos, somente ao vídeo selecionado.
- Play chama o player existente; Detalhes abre o modal existente. Os metadados não recebem notas, datas ou durações fictícias.

## Persistência e atualização

`ghost_alazterflix_card_preferences` salva estilo, visibilidade e alinhamento. Esta chave e `ghost_alazterflix_favorites` fazem parte do backup de preferências. `userRating`, `isWatched` e `manualWatched` ficam no catálogo do plugin. O backend valida os limites da nota e grava alterações com a fila de escrita da biblioteca.

O novo IPC `cinemaUpdateMediaPreferences` exige o provedor atualizado. O pacote `plugins/alazterflix-v1.3.0.ghost` contém esse provedor, com versão mínima Ghost 0.3.1-beta. Instalar o pacote em Plugins atualiza o provedor; o aplicativo também precisa conter os componentes desta implementação. Para obter notas de obras já catalogadas, configurar o token de leitura TMDB e usar **Atualizar informações** em Capas e metadados.

## Validação

- TypeScript aprovado.
- 39 testes Jest passaram: catálogo, notas/preferências, Cinema e limite do backup. Incluem 0/10/decimais, entradas inválidas, remoção da nota, propagação por obra, ausência de votos, separação TMDB/IMDb, preservação do progresso e continuidade do status assistido.
- Componentes reais montados em Electron, com serviços simulados: três estilos; prévias nos dois acessos de configurações; três alinhamentos; título externo sem fundo; nota decimal; favoritos/assistidos independentes; Play/Detalhes; teclado; recarregamento; larguras de 320, 420, 600, 900 e 1400 px.
- Componentes reais verificados no navegador com emulação de toque em 320 px, incluindo normalização de vírgula, gravação do check e alvos de 44 px. Isto não substitui teste em dispositivo físico.
- Novos componentes sem erros/avisos de ESLint; arquivos compartilhados conservam ocorrências anteriores. Não declarar lint integral limpo.
- `electron-vite build` aprovado; avisos de chunk grande e background preexistente permanecem.
- Pacote oficial extraído e verificado: manifesto 1.3.0, integridade dos checksums e código-fonte idêntico.

Evidências locais: `.system_generated/tasks/alazterflix-cards/`. As mídias e a API dos testes visuais são simuladas; não foram alterados arquivos de vídeo do usuário nem medidos FPS.
