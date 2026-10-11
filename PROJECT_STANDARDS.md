# 🏛️ Padrões e Convenções do Projeto (Brownfield Edition)

Este documento estabelece as regras e convenções deste repositório, incluindo o mapeamento de padrões existentes e as barreiras contra propagação de código legado.

---

## 1. Stack Tecnológica & Versões Vigentes

* **Linguagem Principal**: [Ex: TypeScript 5.x / Python 3.12 / C# .NET 8]
* **Framework Principal**: [Ex: NestJS / FastAPI / React 19 / ASP.NET Core]
* **Banco de Dados**: [Ex: PostgreSQL 16 + Redis]
* **Gerenciador de Pacotes**: [Ex: pnpm / poetry / npm]

---

## 2. Convenções Atuais (O que o projeto JÁ adota)

| Elemento | Convenção Vigente | Exemplo |
| :--- | :--- | :--- |
| **Banco de Dados (Tabelas/Colunas)** | `snake_case` | `user_account`, `created_at` |
| **Chaves de Payloads de API (JSON)** | `snake_case` (ou `camelCase`) | `user_id` |
| **Estrutura de Pastas** | Por Módulo / Domínio | `src/modules/[nome]/` |
| **Injeção de Dependências** | Construtor / Framework | `@Injectable()` |

---

## 3. Escudo Anti-Legado (Zonas Proibidas e Dívidas Conhecidas)

> [!WARNING]
> A IA **NUNCA** deve usar estas práticas ou bibliotecas, mesmo que as encontre em arquivos antigos do projeto.

### 🚫 Bibliotecas Proibidas (Legadas / Depreciadas)
* **NÃO USE** `[Nome da lib antiga, ex: request / axios / moment.js]`.  
  👉 **USE EM VEZ DISSO**: `[Nova lib ou nativo, ex: fetch / date-fns]`.
* **NÃO USE** `[Outra lib antiga]`.  
  👉 **USE EM VEZ DISSO**: `[Substituto oficial]`.

### 🚫 Pastas Restritas
* Não adicione novas classes ou arquivos em: `[ex: src/legacy/ ou src/v1/]`. Novos códigos devem sempre ser criados na estrutura moderna: `[ex: src/modules/]`.

---

## 4. Tratamento de Exceções e Respostas

1. **Erros de Domínio**: Devem lançar exceções controladas da aplicação, nunca erros genéricos ou `throw "string"`.
2. **Códigos HTTP**: Respeitar a semântica padrão (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity`).
