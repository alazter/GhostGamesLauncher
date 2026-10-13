# Jogos permanecendo na lista de atualizações

Relato recebido em 13/10/2026: na versão 0.3.1, o jogo continuava no filtro
`libraryQuickActionBtn--updates` depois de atualizado. O código local investigado
é da versão 0.3.2-beta. A loja e o jogo do relato não foram identificados; não
houve atualização de um jogo real no perfil do usuário nesta investigação.

## Causas verificadas no código

- O contador, o filtro e os selos da biblioteca usam `GlobalState.gameUpdates`.
- O instalador externo substitui a instalação, limpa `availableUpdate` e emite
  `external-games-updated`. O estado global não escutava esse evento; o evento
  `refreshLibrary` subsequente recarregava metadados sem verificar atualizações.
- `refresh()` capturava `gameUpdates` antes de operações assíncronas e gravava
  essa cópia depois, podendo restaurar jogos que já tinham saído da lista.
- A conclusão só renovava a lista quando o status anterior era `updating`.
  Status intermediários como `extracting`/`queued`, ausência de status anterior
  e uma recarga já em andamento deixavam essa sincronização incompleta.
- O tratamento antigo removia o indicador também em `error`, sem confirmar
  se a atualização continuava pendente.

## Correção local

`GlobalState` passa a reconciliar instalações externas com o evento e uma
consulta inicial ao estado do backend. Atualizações das outras lojas são
preservadas. Eventos que só mudam o progresso não alteram a lista.

Consultas de atualizações aplicam apenas a resposta da solicitação mais recente
e reconciliam o resultado com o estado externo atual. IDs externos removidos são
lembrados durante a sessão para evitar que uma consulta antiga os restaure.
Recargas de metadados não sobrescrevem mais `gameUpdates`.

Eventos terminais de downloads consultam o backend mesmo durante outra recarga.
Cancelamento ou falha mantém o indicador quando o backend ainda informa uma
atualização pendente. A persistência continua em `componentDidUpdate`.

## Validação

- Comparação com uma cópia do código original da 0.3.2-beta: quatro testes de
  conclusão/cancelamento falharam antes da correção. A cópia recebeu apenas um
  export da classe para o teste, foi usada com moduleNameMapper e removida depois.
- 13 testes em `src/backend/__tests__/gameUpdateState.test.ts`: conclusão,
  persistência do contador, atualizações novas, progresso sem recarga,
  cancelamento/falha, remoção, respostas antigas e recarga concorrente.
- 59 testes em `src/backend/plugins/__tests__/externalGames.test.ts`, incluindo
  substituição real de arquivos em pasta temporária e emissão do estado com a
  versão nova e sem atualização pendente.
- `pnpm run codecheck` e `pnpm exec electron-vite build` verificam tipos e build.
- O lint de `GlobalState.tsx` apresenta os mesmos 19 erros anteriores à alteração; a comparação
  usa uma cópia temporária do arquivo original obtido por `git show HEAD`, na mesma
  pasta. Esses problemas não foram corrigidos nesta tarefa.

## Verificação manual na próxima versão

1. Abrir o filtro de jogos com atualização disponível e registrar a contagem.
2. Atualizar um jogo listado e aguardar também extração/instalação terminar.
3. Confirmar que o jogo sai do filtro e a contagem diminui sem reiniciar.
4. Sair/voltar à biblioteca e reiniciar o launcher: o jogo deve continuar fora.
5. Cancelar outra atualização: se ela ainda estiver pendente, o jogo deve
   permanecer na lista.

Correção validada por testes locais; a reprodução e aprovação visual com o jogo
original do relato seguem pendentes.
