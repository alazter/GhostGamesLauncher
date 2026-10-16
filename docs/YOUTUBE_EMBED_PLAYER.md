# Player do YouTube — erro 153

Em 15/10/2026, o erro foi reproduzido no componente real `ReleaseDetails`, em Electron isolado, carregando a interface por `file://`. O iframe já usava `strict-origin-when-cross-origin`, mas o arquivo local não fornecia um cabeçalho HTTP `Referer`.

O YouTube exige identificação do cliente e recomenda que aplicativos desktop a enviem por esse cabeçalho. O Ghost agora envia `https://com.ghostgameslauncher.ghost/`, correspondente ao identificador registrado em `electron-builder.yml` e `main.ts`.

## Implementação

- `src/backend/rendererRequestHeaders.ts`: interceptor compartilhado da sessão principal; identifica somente navegações HTTPS de subframes para `/embed/<id>` nos domínios exatos do YouTube, originadas na janela principal. Preserva Referer HTTP/HTTPS existente, outros cabeçalhos e o modo `--spoof-windows`.
- `src/backend/main.ts`: registra o interceptor antes de criar/carregar a interface principal. A identificação e o modo Windows usam o mesmo listener: no Electron, registrar outro `onBeforeSendHeaders` substituiria o anterior.
- `src/frontend/screens/ExternalGames/index.tsx`: explicita a mesma política de referência já usada nos trailers de Lançamentos.

O player oficial, o domínio youtube-nocookie e o isolamento do iframe são mantidos. A alteração não modifica requisições de contas, outras janelas, Vimeo ou o restante dos sites. Não muda regras de vídeos privados, indisponíveis ou que proíbem incorporação.

## Verificação

- Quatro testes de regressão do interceptor: domínios/IDs válidos, identidade local, preservação de cabeçalhos e referers web, escopo por janela/recurso/rota e compatibilidade com `--spoof-windows`.
- Oito testes de parser de Lançamentos, incluindo validação das mídias permitidas.
- TypeScript sem erros, ESLint dos novos módulos sem avisos/erros e build completo aprovado. O build mantém avisos preexistentes de assets, imports circulares e tamanho de chunks.
- Componente real em Electron isolado: sem a correção, requisição sem Referer, mensagem “Erro 153”, vídeo em `readyState=0` e tempo zero. Com a correção, Referer com a identidade do Ghost, player sem erro, `readyState=4`, reprodução ativa e tempo avançando além de um segundo. Vídeo público de teste: `M7lc1UVf-VE`, Google for Developers.
- Dados, sessões e processo do usuário preservados. O teste de reprodução não usa mocks de respostas do YouTube. O build não é publicação de instalador; alterações no processo principal exigem reinício do Ghost para entrar em vigor.

## Referências oficiais

- [Identificação de clientes do player incorporado](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity).
- [Código 153 na API do player](https://developers.google.com/youtube/iframe_api_reference#onError).
- [Electron WebRequest: um listener por evento](https://www.electronjs.org/docs/latest/api/web-request).
