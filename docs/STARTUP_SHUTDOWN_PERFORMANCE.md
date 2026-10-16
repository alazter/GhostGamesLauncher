# Inicialização e encerramento — 15/10/2026

## Causas e mudanças

A janela aguardava `PluginManager.init()`, que por sua vez esperava o self-test
dos motores instalados, inclusive do Obscura desabilitado. Cada execução de
worker poderia consumir até 20s antes da criação da janela. Os metadados,
regras e preferências agora são carregados com `deferVerification`; a validação
do executável continua obrigatória antes do primeiro uso, sob o lock existente.
Uma verificação malsucedida invalida o cache de validação. Rollback e fallback
nativo permanecem disponíveis. Instalações novas e verificações manuais seguem
executando seus testes normalmente.

As rotas do React recebiam Promises já iniciadas: `makeLazyFunc(import(...))`.
Isso começava a carregar todas as páginas na abertura, apesar do nome lazy.
Agora recebem funções `makeLazyFunc(() => import(...))`, acionadas apenas para
a rota escolhida. Modais globais ainda fazem parte da interface inicial. Não
houve alteração de layout, capas, biblioteca ou preferências.

Em desenvolvimento, a instalação opcional do React DevTools também aguardava
rede antes de `loadURL`. Ela foi movida para uma tarefa independente; o
carregamento da janela não espera essa extensão.

O fechamento aguardava sequencialmente credenciais/comunicação do GOG e depois
o backup em nuvem, sem um prazo global. `createExitHandler` agora:

- Reúne cliques repetidos em uma só confirmação e um só backup.
- Preserva a confirmação para operações pendentes e a possibilidade de desistir.
- Oculta a janela assim que a saída é confirmada.
- Executa presença e backup em paralelo, com prazos independentes: **1,5s** para
  presença e **15s** para o backup configurado na saída. Tarefas rápidas não
  aguardam esses prazos; os timers são removidos ao concluir.
- Cancela a requisição GOG e o helper `gogdl-get-credentials` quando necessário.
- Passa o cancelamento do backup à renovação do token, listagem, upload e limpeza
  dos arquivos anteriores. Não inicia um upload depois de cancelado e não marca
  backup interrompido como sucesso. Falhas são registradas; os dados locais não
  são removidos. O prazo limita a espera/rede, não preempta JavaScript síncrono
  durante a montagem do payload.

Backups manuais e diários continuam sem esse prazo de saída, pois o sinal é um
parâmetro opcional. A opção de sair para a bandeja é respeitada antes desse
fluxo. Foi corrigido também o iterador de `callAllAbortControllers`: `for...in`
no objeto iterador não cancelava as operações; agora percorre as chaves com
`for...of`.

## Medições e testes

Electron real, perfil temporário, Scrapling 0.4.15 e Obscura 0.2.4 instalados:

| Etapa | Resultado |
| --- | --- |
| Inicialização com self-tests antes da janela | 6.792 ms |
| Inicialização apenas dos metadados | 6,37 ms |
| Ocultação no teste de saída | 0,16 ms |
| Backup local controlado iniciado/concluído | 14,69 ms |
| Saída com presença propositalmente travada | 1.524 ms |

Esses tempos medem as etapas isoladas acima, não todo o arranque do Ghost no
Windows. O teste confirmou o worker real validado e executado no primeiro uso.
O teste de saída usou uma janela Electron, uma presença simulada travada e um
arquivo local controlado, sem contas pessoais ou upload real.

O teste de rotas compila as declarações reais do App e registra a avaliação dos
módulos de tela: nenhuma rota é importada previamente; abrir Biblioteca e
Buscar Jogos importa somente as respectivas telas. As implementações das
telas são substituídas nesse teste, para não executar suas integrações.

**77 testes em 11 suítes e quatro snapshots passaram**, cobrindo também janela,
bandeja, plugins, preferência de backup, presença cancelada e os três provedores
de nuvem. TypeScript e build isolado passaram. Os mocks antigos do Electron
foram atualizados com APIs de ícone/caminho/displays já usadas pela janela.

Lint dos novos módulos, presença, abort handler e App passou. Os arquivos
legados ainda possuem pendências de lint anteriores à alteração; a comparação
de base, sem novos diagnósticos, fica em `lint-baseline.json`. Nenhuma limpeza ampla foi feita nesses
arquivos por causa desta otimização.

Evidências em `.system_generated/tasks/lifecycle-performance/`: `native.log`,
`regression-final.log`, `types-final.log`, `build.log` e `lint-baseline.json`.
Validação do usuário com seu perfil habitual ainda pendente.
