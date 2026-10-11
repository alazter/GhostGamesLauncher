# Destaques dinâmicos do Alazterflix

O destaque da biblioteca aparece somente em **Para você** e utiliza títulos
reais da biblioteca, agrupados por obra. A seleção anterior mostrava sempre
as três primeiras obras com maior prioridade de imagem/nota e exigia clique
para mudar de indicação.

Agora `featuredCatalog.ts` embaralha as obras e seleciona até três títulos
distintos. `useFeaturedCatalog.ts` alterna a indicação a cada **7 segundos**.
Após a terceira indicação, seleciona outro grupo a partir da fila restante;
a fila só é embaralhada novamente quando os títulos disponíveis se esgotam.
Na retomada de um ciclo, prioriza obras fora do grupo anterior e evita repetir
a última indicação imediatamente quando há mais de uma obra.

Entrar novamente em Para você também avança para outro grupo. Atualizações
de progresso, notas e metadados não reiniciam o sorteio ou o cronômetro se
os IDs das obras continuarem iguais. Obras removidas são excluídas da fila;
novas obras são incluídas. Com apenas uma obra, o destaque fica estático;
com duas, utiliza duas indicações; com biblioteca vazia, não monta o banner.

A imagem e o conteúdo aparecem com um fade de 550 ms. A preferência de
movimento reduzido desativa a animação. Os indicadores permitem escolher
manualmente uma indicação e existe um botão para pausar/retomar a rotação.
O cronômetro pausa ao passar o mouse, focar controles do banner, ocultar a
janela/documento, abrir detalhes/edição/player ou sair de Para você. Ao
retomar, o intervalo começa novamente, permitindo ler e usar os controles.
Timers e listener de visibilidade são removidos no cleanup dos efeitos.

## Validação

- Oito testes unitários: bibliotecas de zero a três obras, seleção aleatória,
  ciclos sem repetição, lotes incompletos, IDs duplicados, inclusão/remoção
  de obras e preservação dos arrays de entrada.
- AlazterflixScreen real em Electron com serviços e mídias simulados e relógio
  controlado: nove títulos distintos consecutivos, troca dos três indicadores,
  intervalo de sete segundos, seleção manual, pausas por mouse/foco/botão/
  visibilidade/detalhes, largura de 390 px, movimento reduzido e remoção de
  obras até uma biblioteca vazia. Sem erros de página.
- Regressão da navegação: seis abas sem banner/continuação e restauração de
  ambos em Para você, em desktop e tela pequena.
- TypeScript, ESLint dos arquivos novos e compilação do aplicativo passaram.

Evidências: `.system_generated/tasks/alazterflix-featured/result.json` e
`.system_generated/tasks/alazterflix-sections/result.json`. Não houve alteração
de mídias ou histórico do perfil pessoal, nem medição de FPS.

## 1.3.1: Surpreenda-me e imagens do banner

O selo **Destaque da biblioteca** foi removido. O botão **Surpreenda-me**, ao
lado de Saiba mais, avança imediatamente para outro grupo de até três obras
reais do catálogo, reiniciando no primeiro indicador. Os controles continuam
montados durante a troca, preservando o foco de teclado.

O primeiro ajuste com todas as imagens em `object-fit: contain` foi rejeitado
pelo usuário: a imagem horizontal ficava pequena à direita e deixava um grande
espaço vazio no centro. O enquadramento atual verifica as dimensões carregadas:
fundos horizontais preenchem 82% da largura com `object-fit: cover`, alinhados
ao topo, e o banner cresce de 360 a 520 px conforme a largura disponível.
O recorte inferior é permitido para preencher a área; não se promete imagem
inteira em fundos horizontais. Máscara suave e degradê concentrado no texto
integram a arte ao painel, sem uma borda vertical aparente. Em telas pequenas,
a arte ocupa toda a largura e o degradê mantém os controles legíveis.

Capas verticais e imagens quadradas mantêm `contain`, alinhadas à direita,
sobre um preenchimento decorativo desfocado da mesma imagem, evitando ampliar
um pôster vertical para ocupar a área panorâmica.
O fundo horizontal tem prioridade; erros de carregamento permitem
tentar a imagem local e depois o pôster. Quando não há imagem válida, permanece
o fundo do banner com as informações reais da obra.

Buscar capas em português agora inclui obras com capa portuguesa existente
quando falta um fundo local. A seleção TMDB prioriza imagens horizontais em
resolução original, maiores e sem texto; utiliza também o backdrop padrão
quando o conjunto de imagens não fornece alternativas. Um pôster português
já existente não é substituído apenas para preencher o fundo. Fundos locais
existentes e imagens protegidas manualmente permanecem preservados. Downloads
de fundos remotos são conferidos pelas dimensões reais antes de escrever os
arquivos: uma imagem vertical é recusada sem substituir a imagem anterior.

Validação desta revisão: 53 testes em quatro suítes; componente real em
Electron com Surpreenda-me, três indicações distintas, foco preservado,
rotação/pausas, imagem horizontal, capa vertical, falha da imagem remota e
fallback, largura 390 px e bibliotecas vazia/única. Screenshots revisados em
`.system_generated/tasks/alazterflix-surprise`. A navegação das sete abas,
TypeScript, lint dos módulos modificados e compilação passaram. Pacote oficial
`plugins/alazterflix-v1.3.1.ghost` empacotado e conferido por extração/checksum;
o código da instalação canônica local foi comparado com o fonte final.
Preferências, histórico e arquivos de vídeo do perfil pessoal não foram alterados.

### Revisão do preenchimento do banner (11/10/2026)

Componente real em Electron: preenchimento do centro nas larguras 1820/1400/390,
fallback vertical inteiro, erro remoto seguido do pôster, Surpreenda-me/foco,
rotação de 7 segundos, pausas e bibliotecas vazia/única. Revisão visual também
com o arquivo local de Matrix mostrado no relato, lido sem modificar a pasta de
mídias ou o armazenamento do perfil. Evidências em
`.system_generated/tasks/alazterflix-hero-fill/result.json` e screenshots nessa
pasta. TypeScript, ESLint do componente e build passaram. A validação técnica
não substitui a aprovação visual do usuário. Esta revisão altera o frontend
do Ghost; o pacote do provedor permanece na versão 1.3.1.
