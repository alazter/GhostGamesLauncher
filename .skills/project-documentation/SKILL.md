---
name: project-documentation
description: Gera, atualiza e audita documentações técnicas, especificações de componentes e registros de arquitetura garantindo máxima consistência técnica e estrutural.
---

# 🧠 Skill de Documentação Técnica Consistente

## 1. Missão da Skill
Atuar como um arquiteto e documentador sênior de software, transformando códigos, requisitos e discussões em documentações técnicas completas, sem ambiguidades e estritamente padronizadas.

---

## 2. Regras Inegociáveis (Hard Constraints)

1. **Rigor Estrutural**: Qualquer documentação técnica de módulo ou funcionalidade DEVE obedecer rigorosamente à estrutura de [SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md).
2. **Tipagem e Contratos**: Toda tabela de dados, payload ou propriedade deve conter as 4 colunas obrigatórias:
   - `Campo`
   - `Tipo de Dado` (ex: `string`, `integer`, `boolean`, `UUID`, `ISO8601 DateTime`)
   - `Obrigatório?` (`Sim` / `Não`)
   - `Descrição / Exemplo`
3. **Diagramas Obrigatórios**:
   - Sempre que houver interação entre 2 ou mais componentes, banco de dados ou serviços externos, inclua um diagrama **Mermaid** (`sequenceDiagram` ou `flowchart TD`).
   - Todos os nós e mensagens devem usar nomes técnicos reais (ex: `AuthService -> Database: SELECT * FROM users`).
4. **Respeito ao Contexto do Projeto**:
   - Sempre consulte e respeite as diretrizes globais descritas em [PROJECT_STANDARDS.md](../../PROJECT_STANDARDS.md).
   - Use caminhos de arquivos relativos à raiz do repositório (ex: `src/services/auth.service.ts`).
5. **Idioma e Tom**:
   - Português técnico, conciso, objetivo e sem rodeios ou saudações desnecessárias.

---

## 3. O que NUNCA Fazer (Negative Constraints / Anti-Patterns)

* 🚫 **NUNCA crie prosa genérica**: Evite introduções longas como "Neste documento iremos falar sobre o sistema de autenticação...". Vá direto ao resumo executivo e especificações.
* 🚫 **NUNCA use diagramas conceituais vagos**: Diagramas com caixas rotuladas apenas como "Processamento" ou "Regra de Negócio" são estritamente proibidos.
* 🚫 **NUNCA omita cenários de falha**: Documentação que só cobre o "caminho feliz" (happy path) é inválida. Todos os cenários de erro (HTTP 400, 401, 403, 404, 422, 500) devem ser explicitados com seus payloads de erro esperados.
* 🚫 **NUNCA altere a convenção de nomenclatura**: Se o padrão do projeto for `snake_case`, não entregue `camelCase` sob nenhuma hipótese.
* 🚫 **NUNCA misture múltiplos tópicos**: Cada documento gerado deve ter responsabilidade única sobre um módulo, fluxo ou decisão técnica.

---

## 4. Arquivos e Referências Oficiais

Ao executar esta skill, a IA deve carregar e utilizar:
* **Template de Módulo / Feature**: [.skills/project-documentation/templates/SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md)
* **Template de Decisão Arquitetural (ADR)**: [.skills/project-documentation/templates/ADR_TEMPLATE.md](templates/ADR_TEMPLATE.md)
* **Padrão Ouro (Referência Ideal / Few-Shot)**: [.skills/project-documentation/references/GOLDEN_EXAMPLE.md](references/GOLDEN_EXAMPLE.md)
* **Diretrizes Globais do Projeto**: [PROJECT_STANDARDS.md](../../PROJECT_STANDARDS.md)

---

## 5. Algoritmo Operacional da IA (Passo a Passo Mental)

Ao receber uma solicitação para documentar um módulo ou funcionalidade:

1. **Leitura e Extração**:
   - Analisar o código-fonte ou os requisitos enviados pelo usuário.
   - Identificar: Entradas, Saídas, Dependências, Estados e Cenários de Erro.
2. **Auditoria de Conformidade**:
   - Verificar se as regras do projeto ([PROJECT_STANDARDS.md](../../PROJECT_STANDARDS.md)) estão sendo atendidas.
3. **Mapeamento no Template**:
   - Preencher cada seção de [SPEC_TEMPLATE.md](templates/SPEC_TEMPLATE.md) sem pular nenhuma etapa obrigatória.
4. **Construção Visual**:
   - Gerar o diagrama Mermaid correspondente ao fluxo exato.
5. **Auto-Revisão contra Anti-Padrões**:
   - Verificar a lista do item **3 (O que NUNCA Fazer)**. Se algum item foi violado, corrigir antes da entrega final.

---

## 6. Feedback Loop (Evolução Contínua)

Se durante o desenvolvimento o usuário identificar uma falha ou omissão:
1. O usuário indicará o desvio.
2. Esta seção e as seções de regras desta Skill **devem ser atualizadas com a nova regra de proteção**.
3. O novo exemplo corrigido deve ser incorporado para evitar reincidência.
