# 🎬 Alazterflix Plugin (v1.3.3)

Plugin oficial de Mídia, Catálogo Jellyfin e Integração Stremio Protocol v3 para o **Ghost Games Launcher**.

---

## Novidades da versão v1.3.3: nomes originais das pastas

A origem Pasta conserva nomes como One Punch Man, Vinland Saga e títulos
alternativos entre parênteses, sem remover palavras legítimas como tags de
release. Remove apenas sufixos técnicos identificáveis e notas de andamento.
Pastas de sagas ou com filmes distintos mantêm os nomes individuais dos arquivos;
subpastas próprias de um filme continuam tendo prioridade. Categorias como
Filmes não fazem arquivos soltos herdarem o nome da raiz da biblioteca.
A preferência é respeitada também ao reabrir o Ghost. Dados manuais protegidos,
caminhos, notas e histórico permanecem preservados. Pacote: alazterflix-v1.3.3.ghost.

## Novidades da versão v1.3.2: lista de continuação e tamanhos por página

Em Continue de onde parou, Ver todos revela Limpar lista. A limpeza retira os
vídeos dessa lista preservando o ponto de reprodução e o status assistido.
Ao assistir novamente, o vídeo volta à lista. Ver todos inclui toda a lista.

O tamanho das capas é salvo separadamente para Todos, Para você, Animes,
Séries, Filmes, Documentários, Desenhos e Stremio, incluindo backup de
preferências. O tamanho global anterior serve como ponto de partida.
Requer o Ghost com esta integração de interface. Pacote: alazterflix-v1.3.2.ghost.

## Novidades da versão v1.3.1: indicações e fundos horizontais

Em Para você, Surpreenda-me escolhe outro grupo de até três obras do catálogo.
A rotação automática continua a cada sete segundos. O selo Destaque da biblioteca
foi removido. Fundos horizontais preenchem o banner com enquadramento superior;
capas verticais permanecem inteiras com preenchimento desfocado ao redor.

Buscar capas em português também busca fundos horizontais ausentes no TMDB,
mesmo quando a obra já tem uma capa em português. Prioriza imagens horizontais
em resolução original e conserva as imagens locais e as escolhas manuais.
Configure o token de leitura TMDB em Capas e metadados para realizar a busca.
O pacote desta versão é alazterflix-v1.3.1.ghost.

## Novidades da versão v1.3.0

Em Configurações → Aparência dos cards, escolha entre Estilo atual, Informações abaixo e Capa limpa, com prévias das três opções. A capa limpa pode exibir o nome fora da imagem, abaixo dela, sem fundo; o alinhamento pode ser à esquerda, centralizado ou à direita. As preferências são salvas automaticamente e também estão disponíveis no diálogo de configuração do plugin.

Os dois estilos novos revelam um overlay de baixo para cima com metadados reais, Play, Detalhes, estrela para favoritos e check para assistido. A nota da mídia é do TMDB; sem identificação ou avaliação disponível, aparece “—”. A nota pessoal aceita de 0 a 10, incluindo decimais: `9,5` é salvo e exibido como `9.5`. Notas pessoais e assistidos ficam no armazenamento do plugin; em obras agrupadas, a alteração vale para os episódios da obra. Marcar como assistido preserva o ponto de reprodução.

Requer o Ghost com a integração de cards desta atualização (0.3.1-beta ou posterior). Instale `alazterflix-v1.3.0.ghost` na página Plugins para atualizar o provedor. Para identificar obras e obter notas do TMDB, configure seu token de leitura em Capas e metadados e use Atualizar informações. A configuração de aparência e os favoritos locais estão incluídos no backup de preferências do Ghost.

## 🚀 Novidades da Versão v1.2.0

* **Stremio Subtitle Studio Completo**:
  * **Posicionamento Vertical Soberano (85% Padrão)**: Evita colisão e sobreposição de legendas sobre a barra de controles e a timeline do player (`.player-controls-bottom`).
  * **Pílulas de Presets Rápidos**: `Baixa (95%)`, `Padrão (85%)`, `Média (75%)`, `Alta (60%)`, `Topo (15%)`.
  * **Micro-ajustes Milimétricos em Tempo Real**: `[▲ Subir (-5%)]`, `[▲ -1%]`, `[85% Padrão]`, `[▼ +1%]`, `[▼ Descer (+5%)]`.
  * **Atalhos Globais de Teclado**: `Shift + Seta para Cima` (-5% / subir) e `Shift + Seta para Baixo` (+5% / descer).
  * **Persistência Imediata**: Salva automaticamente em `ghost_alazterflix_sub_settings` no `localStorage`.
* **Suporte Universal de Áudio AC3 / EAC3 (Dolby Digital / Plus)**:
  * Remux transparente e ultra-rápido para Fragmented MP4 (FMP4) com áudio AAC em tempo real via FFmpeg sem reencodar vídeo (0% CPU de vídeo e aceleração gráfica de 120 FPS mantida).
* **Extração Sob Demanda de Legendas Embutidas**:
  * Suporte nativo a faixas de legendas internas em containers MKV e MP4 via rota `/subtitle/embedded`.
* **Gaveta Lateral de Episódios Aprimorada**:
  * Thumbnails 16:9 estilo Netflix/Stremio, Stepper sequencial (`< 3ª TEMPORADA >`) e seletor Dropdown Stremio.
* **Integração Total Stremio Protocol v3**:
  * Busca de streams e legendas nos addons instalados pelo usuário.
