# Guia Definitivo: Expansão da Barra Lateral Esquerda do Releases.com

Este documento serve como referência definitiva para a expansão e formatação da barra lateral esquerda na tela do Releases (`src/frontend/screens/Releases/index.tsx`).

---

## 🎯 Problema Resolvido

O layout nativo do Releases.com limita a largura da barra lateral esquerda (geralmente entre 200px-240px), o que faz com que o logo `releases` e vários itens de menu em Português ou Inglês fiquem cortados (ex: exibindo `relea...` ou comprimindo os textos).

---

## 🛠️ Solução Comprovada (Implementação)

Para expandir a barra lateral esquerda **sem quebrar o layout** nem distorcer os elementos internos, é necessário aplicar simultaneamente **duas regras essenciais** em `insertCSS` e no script dinâmico de `executeJavaScript`:

### 1. Conjunto de Seletores Abrangentes de Largura & Cor de Fundo
A barra lateral do Releases.com utiliza múltiplos contêineres e classes aninhadas. A largura e o fundo `rgba(3, 4, 5, 1)` devem ser aplicados a todos os seletores principais (incluindo o contêiner de troca de temas `.RWPC-Nav-ThemeMode`):

```css
aside,
nav,
div[class*="sidebar"],
div[class*="Sidebar"],
div[class*="menu"],
div[class*="Menu"],
div[class*="left-nav"],
div[class*="LeftNav"] {
  min-width: 280px !important;
  width: 280px !important;
  background-color: rgba(3, 4, 5, 1) !important;
  background: rgba(3, 4, 5, 1) !important;
}

/* Contêiner do Alternador de Temas no Rodapé */
.RWPC-Nav-ThemeMode,
[class*="RWPC-Nav-ThemeMode"],
[class*="ThemeMode"],
[class*="themeMode"],
[class*="Theme-Mode"] {
  background-color: rgba(3, 4, 5, 1) !important;
  background: rgba(3, 4, 5, 1) !important;
  border: none !important;
  box-shadow: none !important;
}
```

### 2. Desbloqueio e Formatação de Texto/Ícones Internos
Para garantir que o texto (ex: logo `releases`, botões e rótulos de navegação) se expanda completamente sem sofrer recortes com reticências (`ellipsis`) ou quebras de linha indesejadas, todos os links, botões, spans e rótulos internos devem ter as propriedades abaixo:

```css
aside a,
aside button,
aside span,
nav a,
nav button,
nav span,
div[class*="sidebar"] a,
div[class*="sidebar"] button,
div[class*="sidebar"] span,
div[class*="Sidebar"] a,
div[class*="Sidebar"] button,
div[class*="Sidebar"] span,
div[class*="menu"] a,
div[class*="menu"] button,
div[class*="menu"] span,
[class*="label"],
[class*="text"],
[class*="title"] {
  white-space: nowrap !important;
  word-break: keep-all !important;
  text-overflow: clip !important;
  overflow: visible !important;
}
```

---

## 📌 Regras de Ouro
1. **Nunca utilize seletores genéricos em varreduras JS como `querySelectorAll('*')`** para alterar fundos de elementos filhos da barra lateral esquerda, pois isso destrói contêineres internos e botões de navegação do topo.
2. **Mantenha os seletores abrangentes (`aside`, `nav`, `sidebar`, `menu`, `left-nav`, `.RWPC-Nav-ThemeMode`)** para garantir compatibilidade com atualizações da página Releases.com.
3. **Largura recomendada**: `280px` oferece o equilíbrio ideal entre visibilidade completa do logo `releases` e espaço para os jogos na área central.
