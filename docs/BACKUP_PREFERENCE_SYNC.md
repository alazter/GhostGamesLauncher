# Sincronização das preferências de backup

Em 11/10/2026, o console mostrou uma falha no IPC `syncLocalStorageBackup`:
`EPERM` ao renomear `store/config.json.tmp-*` para `store/config.json`.
O arquivo de configuração não estava marcado como somente leitura. A falha
indica que a substituição do arquivo foi recusada pelo Windows; o processo que
provocou o bloqueio no aplicativo do usuário não foi identificado.

O `electron-store` 8.2.0 utiliza a gravação atômica síncrona do `atomically`,
com tentativas internas limitadas a 100 ms. A sincronização anteriormente
propagava a falha imediatamente após esse limite.

`src/backend/backup/preferenceSync.ts` agora fornece uma fila compartilhada
no backend para sincronização, exportação de arquivo e envio à nuvem. Cada
snapshot é validado e copiado antes de entrar na fila. Para `EPERM`, `EBUSY`
e `EACCES`, a operação tenta novamente após 100, 200, 400, 800 e 1600 ms:
no máximo seis tentativas, com pausas assíncronas.

Cada tentativa chama novamente `GlobalConfig.setSetting`, que lê e combina
as configurações atuais. Isso evita substituir alterações de outras
preferências por um JSON antigo durante a espera. Falhas persistentes ou
outros códigos continuam sendo reportados; a fila pode processar a próxima
solicitação mesmo após uma falha. A confirmação ocorre somente após o
salvamento. Não há remoção do arquivo original nem fallback que substitua
a gravação atômica por uma sobrescrita direta.

## Validação

- 15 testes em três suítes: retentativas, limite de tentativas, erros não
  transitórios, ordenação, validação e cópia dos snapshots, persistência
  com `electron-store` real e compatibilidade da desserialização.
- Teste isolado no Windows com `FileStream` sem compartilhamento de exclusão:
  três falhas reais `EPERM`, sucesso na quarta tentativa e conteúdo original
  preservado até a liberação do bloqueio. Script:
  `.system_generated/tasks/backup-preference-sync/windows-lock-check.cjs`.
- O teste de bloqueio utiliza somente uma pasta temporária própria.
  Nenhuma preferência do perfil pessoal é escrita pelo teste.
- TypeScript (`pnpm run codecheck`), ESLint dos arquivos novos sem avisos
  e compilação (`electron-vite build`) passaram.
