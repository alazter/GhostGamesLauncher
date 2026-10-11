# 📘 Guia de Migração Incremental: Como Adotar Skills em Projetos Existentes

Muitas equipes falham ao tentar implementar governança e consistência de IA em projetos existentes porque tentam "documentar tudo de uma vez". Esse guia ensina a aplicar o método de **Adoção Incremental (Regra do Escoteiro)**.

---

## 🎯 Princípios Fundamentais

1. **Zero Parada de Desenvolvimento**: O time não para de entregar valor. A governança entra no fluxo natural das tarefas.
2. **Regra do Escoteiro**: *"Deixe o acampamento mais limpo do que como você o encontrou"*. Tocou em um módulo legado para alterar ou corrigir? Ele é documentado no novo padrão antes ou depois do commit.
3. **Escudo Anti-Legado**: A IA tende a imitar código ruim se encontrar padrões antigos no projeto. O arquivo `.skills/project-documentation/SKILL.md` atua como um escudo que proíbe a IA de reproduzir dívidas técnicas antigas.

---

## 🛠️ Passo a Passo de Adoção

### 1. Criando a Primeira Âncora (O Padrão Ouro Retrospectivo)
* **Objetivo**: Fornecer à IA um exemplo real e excelente tirado do seu próprio repositório.
* **Ação**:
  1. Encontre um módulo, serviço ou controller que esteja bem escrito, tipado e com tratamento de erros limpo.
  2. Use o **Prompt 1** de `PROMPTS_PRONTOS.md` para gerar a documentação dele.
  3. Salve o arquivo em `.skills/project-documentation/references/GOLDEN_EXAMPLE.md`.
  4. Agora, qualquer nova documentação gerada terá a mesma régua de qualidade do seu melhor código.

---

### 2. Mapeamento da Dívida Técnica em `PROJECT_STANDARDS.md`
Em projetos legados, o que não fazer é tão importante quanto o que fazer:
* Abra `PROJECT_STANDARDS.md` e preencha:
  * **Bibliotecas Proibidas**: (Ex: *"Não use Axios, use fetch"*; *"Não use moment.js"*).
  * **Pastas Proibidas para Novos Códigos**: (Ex: *"Não crie novos arquivos em `src/legacy/`"*).
  * **Convenções Atuais**: Se o banco já usa `camelCase` ou `snake_case`, registre para a IA respeitar o que já existe.

---

### 3. Matriz de Trabalho no Dia a Dia

| Tipo de Tarefa | Ação Obrigatória | Impacto no Projeto |
| :--- | :--- | :--- |
| **Nova Feature / Novo Módulo** | Usar o **Prompt 2**. Criar documentação completa antes de codificar. | Código 100% no padrão novo. |
| **Bugfix Pequeno (< 20 linhas)** | Corrigir direto, mas respeitar `PROJECT_STANDARDS.md`. | Sem burocracia desnecessária. |
| **Refatoração de Módulo Antigo** | Usar o **Prompt 3**. Documentar o módulo antigo primeiro para a IA entender as dependências ocultas. | Refatoração segura e sem quebras. |

---

### 4. O Ciclo de Feedback Real (Quando a IA errar)
Se a IA sugerir uma biblioteca depreciada ou violar uma regra da sua arquitetura existente:
1. **Não corrija apenas no chat**.
2. Abra `.skills/project-documentation/SKILL.md` ou `PROJECT_STANDARDS.md`.
3. Adicione a restrição na seção **"O que NUNCA fazer"**.
4. No próximo chat limpo, o erro não se repetirá.
