# Nomes das pastas no catálogo pessoal

Em 16/10/2026, o usuário pediu para organizar os filmes, séries, desenhos e
animes cadastrados no Ghost, usando as pastas como referência dos nomes.

## Causa e correção

A preferência estava na origem Arquivo. Além disso, a limpeza genérica dos
títulos de obras removia palavras legítimas: One Punch Man se tornava One Man;
Vinland Saga se tornava Vinland; Power o poder por tras da energia perdia por.
Nomes alternativos em parênteses e anos de edições também eram removidos.

O provedor 1.3.3 usa uma limpeza própria para a origem Pasta. Conserva palavras,
nomes alternativos e os anos existentes na pasta. Remove apenas sufixos técnicos
identificáveis e notas como Em andamento ou falta baixar. A preferência salva
também é respeitada na migração de inicialização e na recatalogação de varreduras.

Pastas explicitamente identificadas como saga/coleção não viram o título de cada
filme. Quando arquivos distintos compartilham uma pasta de filmes, usa nomes
individuais dos arquivos para diferenciá-los. Subpastas específicas de um filme
continuam válidas como fonte do título. Pastas genéricas como Filmes não fazem
um arquivo solto herdar o nome da raiz da biblioteca. Títulos numéricos de filmes
como 300 permanecem válidos. A modalidade Arquivo continua disponível.

## Aplicação ao cadastro

- Cópia completa do cadastro anterior em uma subpasta datada de
  `%APPDATA%/ghost/plugin_installation_backups/alazterflix-nomes-pastas-20261016-*`.
  Esse backup contém dados privados e não foi copiado para o repositório.
- Preferência persistente titleSource=folder aplicada ao cadastro existente.
- 995 registros corrigidos: 160 de filmes, 303 de animes, 517 de desenhos,
  14 de documentários e um de séries. Grande parte dos registros são episódios
  da mesma obra; a contagem não representa 995 obras distintas.
- Um override antigo com nome de release foi corrigido para o nome da pasta
  individual: 13 Horas - Os Soldados Secretos de Benghazi. Proteções de outros
  metadados e overrides em pastas compartilhadas foram mantidas.
- Escrita atômica após comparar o hash do cadastro com a versão lida. Alterações
  limitadas a title/cleanTitle/showTitle, ao override de título inequívoco e à
  preferência de origem. Nenhum arquivo/pasta de mídia foi renomeado ou movido.
- Plugin canônico com ID com.ghost.alazterflix atualizado para 1.3.3, com cópia
  do código anterior; nenhum plugin ativo duplicado foi criado. Pacote novo
  conferido por extração e checksum.

## Verificação

39 testes do catálogo passaram após a correção final. A suíte de integração
Cinema passou separadamente com nove testes; TypeScript passou. Os testes
incluem palavras legítimas, nomes alternativos, sufixos técnicos, sagas,
pastas compartilhadas, arquivo solto, títulos numéricos, inicialização com a
preferência salva e preservação de notas/histórico/proteções manuais.

O cadastro pessoal foi relido do disco após a escrita: 5.175 vídeos com os mesmos
IDs/caminhos, notas, estado assistido, progresso e histórico; agrupamento por
obra com a mesma contagem de antes. As evidências e relatórios sem credenciais
ficam em `.system_generated/tasks/alazterflix-folder-organization-20261016`.

A automação de interface foi bloqueada por atividade do usuário. Não houve
confirmação de recarga do provedor ativo; reabrir o Ghost carrega o provedor
atualizado e apresenta os nomes persistidos. Não confundir verificação do
cadastro salvo com confirmação visual na sessão ativa do usuário.
