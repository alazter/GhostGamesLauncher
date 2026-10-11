# 🚀 Kit de Consistência com IA para Projetos em Andamento (Brownfield Edition)

Este kit foi desenvolvido especificamente para ser acoplado em **projetos já existentes e em andamento** sem travar o time, sem quebrar builds e sem a necessidade de parar as entregas para "documentar o passado".

---

## ⚡ Setup Rápido (Menos de 10 minutos)

1. **Extraia esta pasta na raiz do seu repositório atual**:
   Copie os arquivos `.skills/`, `PROJECT_STANDARDS.md`, `PROMPTS_PRONTOS.md` e `GUIA_MIGRACAO_INCREMENTAL.md` para a raiz do seu projeto.

2. **Eleja seu "Módulo Modelo" (Padrão Ouro Retrospectivo)**:
   * Escolha o arquivo ou módulo mais bem escrito do seu projeto existente.
   * Abra o arquivo [PROMPTS_PRONTOS.md](PROMPTS_PRONTOS.md), copie o **Prompt 1 (Engenharia Reversa)** e execute em uma conversa descartável com a IA.
   * Salve a saída aprovada substituindo `.skills/project-documentation/references/GOLDEN_EXAMPLE.md`.

3. **Preencha as restrições reais em [PROJECT_STANDARDS.md](PROJECT_STANDARDS.md)**:
   * Declare a versão real da sua stack, as convenções de pastas já existentes e as bibliotecas antigas que a IA **não** deve utilizar.

4. **Trabalhe sob a "Regra do Escoteiro"**:
   * O código legado antigo continua funcionando normalmente.
   * Toda nova feature, refatoração ou alteração significativa que for tocada a partir de hoje é documentada e padronizada usando a Skill.

---

## 📂 Conteúdo Deste Kit

```text
├── README.md                          # Este arquivo de inicialização rápida
├── GUIA_MIGRACAO_INCREMENTAL.md       # O roteiro detalhado de adoção sem atrito
├── PROJECT_STANDARDS.md               # Padrões do projeto (com seções para isolar legados)
├── PROMPTS_PRONTOS.md                 # 4 Prompts prontos para copiar e colar no dia a dia
└── .skills/
    └── project-documentation/
        ├── SKILL.md                   # Skill da IA configurada com travas de legado
        ├── templates/
        │   ├── SPEC_TEMPLATE.md       # Molde de documentação de módulos/features
        │   └── ADR_TEMPLATE.md        # Molde para registrar decisões arquiteturais
        └── references/
            └── GOLDEN_EXAMPLE.md      # Espaço para o seu Módulo Modelo
```
