# 💬 Biblioteca de Prompts Prontos para Projetos em Andamento

Copie e cole estes prompts diretamente nas suas ferramentas de IA (Antigravity, Claude Code, Cursor, ChatGPT, etc.).

---

## 📌 Prompt 1: Engenharia Reversa do "Módulo Modelo" (Padrão Ouro)
> **Quando usar**: No primeiro dia de setup, para transformar um código bom que você já tem no modelo que a IA deve seguir.

```text
[CONTEXTO]: Estamos implementando um sistema de governança e documentação via Skills neste projeto em andamento.
[OBJETIVO]: Analise o código do nosso módulo existente em anexo e faça a engenharia reversa dele, gerando sua especificação técnica completa no padrão do nosso arquivo `.skills/project-documentation/templates/SPEC_TEMPLATE.md`.
[DIRETRIZES]:
1. Extraia o Resumo Executivo, o fluxo com diagrama Mermaid (sequenceDiagram), contratos de dados tipados, cenários de erro esperados e regras de negócio.
2. Seja ultrapreciso com base no código real fornecido, sem inventar nada que não esteja implementado.
3. Responda estritamente com o Markdown formatado para que eu salve como `GOLDEN_EXAMPLE.md`.

[ARQUIVOS DO MÓDULO MODELO]:
(Cole o código ou referencie os arquivos aqui)
```

---

## 📌 Prompt 2: Criando uma Nova Feature em Projeto Existente
> **Quando usar**: Sempre que for iniciar uma funcionalidade nova em um sistema que já existe.

```text
[CONTEXTO]: Projeto em andamento. Leia rigorosamente:
- `PROJECT_STANDARDS.md` para respeitar convenções e bibliotecas permitidas.
- `.skills/project-documentation/SKILL.md` para aplicar as diretrizes de documentação.
- `.skills/project-documentation/references/GOLDEN_EXAMPLE.md` como exemplo de excelência.

[TAREFA]:
1. Elabore a especificação técnica para a nova funcionalidade: [DESCREVA A FEATURE].
2. Respeite as dependências e o padrão de injeção de dependências já existentes no projeto.
3. Gere o documento no formato de especificação pronto para ser salvo em `docs/modules/[nome-da-feature].md`.

[DADOS / REQUISITOS]:
(Cole os requisitos ou detalhes da funcionalidade aqui)
```

---

## 📌 Prompt 3: Refatoração com Documentação Prévia
> **Quando usar**: Quando for mexer em um código antigo ou confuso e quiser evitar quebrar coisas que funcionavam.

```text
[CONTEXTO]: Este é um módulo legado existente no projeto que precisa ser refatorado.
[ETAPA 1 - ENTENDIMENTO]: Antes de alterar qualquer linha de código, analise o arquivo em anexo e gere uma especificação técnica preliminar baseada em `.skills/project-documentation/templates/SPEC_TEMPLATE.md`.
[ETAPA 2 - RISCOS]: Aponte no documento quais dependências externas e cenários de erro estão implícitos no código atual.
[ETAPA 3 - PROPOSTA]: Só após apresentar a documentação do estado atual, proponha a refatoração respeitando os padrões de `PROJECT_STANDARDS.md`.

[ARQUIVO LEGADO]:
(Cole o código antigo aqui)
```

---

## 📌 Prompt 4: Adicionando Regra pós-Erro da IA (Feedback Loop)
> **Quando usar**: Quando a IA sugerir algo que não encaixa na sua arquitetura ou violar uma regra do projeto.

```text
Você sugeriu uma abordagem que viola os padrões da nossa arquitetura: [DESCREVA O QUE A IA FEZ DE ERRADO, ex: "importou a biblioteca X que foi depreciada" ou "omitiu o tratamento de erro 404"].

Além de corrigir o código agora, gere a linha exata que devo adicionar à seção "3. O que NUNCA Fazer" do nosso arquivo `.skills/project-documentation/SKILL.md` para que nenhuma IA volte a cometer esse erro neste repositório.
```
