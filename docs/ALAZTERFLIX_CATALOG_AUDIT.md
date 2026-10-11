# Verificação do Alazterflix — 05/10/2026

O sistema preserva os nomes do catálogo e oferece busca de capas em português, escolha entre opções online, seleção de imagens do computador e proteção das alterações manuais. A organização segue categorias, obras, temporadas, episódios e especiais.

## Catálogo verificado

A auditoria leu o catálogo real e conferiu a existência dos arquivos, sem modificar os vídeos. A organização corrigida reúne 5.146 vídeos em 377 obras:

| Categoria | Obras |
| --- | ---: |
| Filmes | 284 |
| Séries | 21 |
| Animes | 54 |
| Desenhos | 11 |
| Documentários | 7 |

- Todos os 5.146 vídeos e suas capas locais foram encontrados.
- Os identificadores antigos estavam repetidos: um mesmo ID representava todos os vídeos. A migração corrige isso, conserva os caminhos e cria uma cópia recuperável do catálogo anterior.
- Os nomes atuais foram preservados. As três diferenças de título em relação à cópia anterior correspondem a edições manuais explícitas.
- Obras homônimas em pastas diferentes permanecem separadas. Filmes de uma saga têm cards independentes. Séries documentais explicitamente identificadas na pasta ficam agrupadas.
- Temporadas seguem ordem numérica; especiais ficam na temporada zero.

## Capas em português do Brasil

O catálogo real ainda não possui token TMDB configurado. As capas antigas foram conservadas; a auditoria verifica que existem, mas não confirma o idioma de cada imagem.

Após reabrir o Ghost para carregar as alterações, abra **Alazterflix → Configurações**, informe seu **Token de leitura TMDB** e salve. Na biblioteca, use **Buscar capas em português** para substituir capas antigas sem proteção. Use o botão de edição de cada card para escolher outra opção ou uma imagem local.

O TMDB marca imagens com o idioma `pt`, sem distinguir Brasil de Portugal. Por isso, o editor apresenta as opções disponíveis para escolher a edição brasileira. Quando não há capa portuguesa, mantém a atual e mostra uma pendência. Capas do Cinemeta sem idioma confirmado não são aplicadas automaticamente.

Capas protegidas não são substituídas pela atualização. Uma alteração pode atingir apenas um episódio ou a série inteira. Imagens são salvas junto à mídia para sobreviver a reinstalações, e o cache é atualizado após a edição.

## Verificações realizadas

- 35 suítes de plugins: 332 testes aprovados. Após o ajuste de séries documentais, 28 testes de mídia aprovados, incluindo um novo caso para capas compartilhadas da série.
- Verificação TypeScript e compilação do aplicativo concluídas. Há avisos anteriores de tamanho de pacotes, dependências circulares e uma imagem de login externa ao Alazterflix.
- Interface testada em janela Electron oculta com catálogo fictício: identificação online sem renomear o título, escolha de capa portuguesa, salvamento, proteção e configurações nos dois pontos de entrada.
- Conversão de PNG para JPEG verificada com o decodificador real do Electron.
- Teste em largura de 1.100 px sem transbordamento horizontal.
- Revisão estática dos arquivos de capas e da interface sem erros; 15 avisos remanescentes em trechos antigos de reprodução e chamadas assíncronas.

O teste de interface não substituiu imagens do catálogo real nem usou credenciais reais do TMDB. A busca autenticada ao vivo permanece dependente da configuração do token.

O pacote atualizado está em `plugins/alazterflix-v1.1.0.ghost`; as alterações da interface e do aplicativo também fazem parte desta implementação.
