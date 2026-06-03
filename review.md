# Review das Alterações - 03/06/2026

Compilado de todas as modificações de estilo, alinhamento e estrutura aplicadas na tela de Configurações Inline e Diálogos do Heroic Games Launcher.

---

## 📋 Resumo das Alterações Realizadas

### 1. Separação de Elementos e Alinhamento Preciso com CSS Grid
* **Problema:** As labels e seus respectivos botões de ajuda ("InfoBox" e "Ajuda") compartilhavam o mesmo contêiner Flex, movendo-se e comportando-se como um único bloco.
* **Solução:** 
  - Desacoplamos os labels do executável alternativo ("Selecionar executável") e dos argumentos de inicialização ("Argumentos do jogo") de seus botões de ajuda.
  - Implementamos um layout **CSS Grid** de duas linhas no contêiner pai: `display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end', rowGap: '4px'`.
  - O label (coluna 1) e o botão de ajuda (coluna 2) alinham-se horizontalmente lado a lado no topo como irmãos independentes no DOM.
  - O campo de entrada correspondente ocupa toda a largura na linha de baixo (`gridColumn: '1 / -1'`).
  - Adicionamos `justifySelf: 'start'` e `textAlign: 'left'` às labels para anular heranças de alinhamento central e fixá-las à esquerda.

### 2. Ajuste de Tamanho de Fonte e Margens de Labels
* **Problema:** As labels e vãos visuais precisavam de refinamento no tamanho e espaçamento.
* **Solução:**
  - Aumentamos o tamanho de fonte das cinco labels principais ("Selecionar executável", "Argumentos do jogo...", as duas labels de scripts e "Variáveis de ambiente") de `var(--text-sm)` para `var(--text-md)` (tamanho base de 16px).
  - Ajustamos a margem inferior para `-10px` nas labels inline do painel e `4px` nas demais para manter a proximidade ideal com as caixas de texto.
  - Realocamos a folha de estilos local (`<style>`) para a raiz do painel `inline-game-settings-container`, garantindo que as regras tipográficas e de estilo permaneçam carregadas de forma definitiva na tela (corrigindo o problema do lifecycle no componente de renomear).

### 3. Ajuste de Alinhamento e Tipografia na Tabela de Variáveis de Ambiente
* **Problema:** O cabeçalho "Valor" e o link "Ajuda" estavam desalinhados em relação às bordas das caixas de entrada abaixo deles.
* **Solução:**
  - Removemos o padding horizontal (`padding: 0 0 4px`) dos cabeçalhos da tabela (`th`) no arquivo `TwoColTableInput/index.css`. Agora a palavra "Valor" inicia alinhada à borda esquerda do input e "Ajuda" termina alinhada à borda direita.
  - Removemos a formatação de negrito herdada dos elementos `<th>` aplicando `font-weight: normal` a eles.

### 4. Correção do Pop-up de Ajuda (InfoBox) nas Variáveis de Ambiente
* **Problema:** A janela flutuante de ajuda saía da tela pela direita e o texto interno ficava truncado/sem quebra de linha.
* **Solução:**
  - Adicionamos o atributo `align="right"` à `<InfoBox>` na tabela de variáveis, fazendo o pop-up expandir para a esquerda e ficar 100% visível na tela.
  - Adicionamos `whiteSpace: 'normal'` ao estilo inline da popover no `PopoverComponent` para neutralizar a propriedade `white-space: nowrap` herdada da tabela, permitindo o fluxo e quebra de linhas normal das instruções de texto.

### 5. Visibilidade do Filtro de Alfabeto
* **Problema:** O filtro de alfabeto sumia da biblioteca ao abrir as configurações inline de um jogo.
* **Solução:**
  - Alteramos a renderização de `<LibraryHeader />` em `Library/index.tsx` para rodar de forma incondicional, mantendo o filtro de letras e a contagem de jogos visíveis e fixados de forma sticky no topo da tela.

---

## 🛠️ Arquivos Modificados
- [PopoverComponent/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/PopoverComponent/index.tsx)
- [TextInputField/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/TextInputField/index.css)
- [TwoColTableInput/index.css](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/TwoColTableInput/index.css)
- [TwoColTableInput/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/components/UI/TwoColTableInput/index.tsx)
- [InlineGameSettings/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InlineGameSettings/index.tsx)
- [SideloadDialog/index.scss](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InstallModal/SideloadDialog/index.scss)
- [SideloadDialog/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/InstallModal/SideloadDialog/index.tsx)
- [LibraryHeader/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/components/LibraryHeader/index.tsx)
- [Library/index.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Library/index.tsx)
- [EnvVariablesTable.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/EnvVariablesTable.tsx)
- [LauncherArgs.tsx](file:///c:/Users/alazt/Documents/GitHub/Projetos/HeroicGamesLauncher/src/frontend/screens/Settings/components/LauncherArgs.tsx)
