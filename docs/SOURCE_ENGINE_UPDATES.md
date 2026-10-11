# Atualizações dos motores

Correção de 11/10/2026. O painel de Plugins possui **Instalar atualização [versão]** para Scrapling e Obscura quando há um pacote compatível diferente do instalado. A disponibilidade considera versão e checksum: uma revisão da integração pode atualizar o pacote mantendo a versão do projeto. A instalação manual não depende de habilitar o motor ou de ativar atualizações automáticas.

**Verificar instalação** é uma ação separada. Ela verifica o motor instalado sem instalar uma atualização diferente; conserva a recuperação de uma instalação danificada quando o pacote correspondente está disponível. O instalador rejeita downgrade acidental. O rollback e a espera por operações em andamento permanecem disponíveis.

Uma versão publicada pelo projeto não é suficiente para instalar: é necessário o pacote compatível com o Ghost, para a plataforma/arquitetura atual, com checksum e teste do executável. Quando só há uma publicação nova, o painel mostra o botão indisponível e explica a ausência do pacote. Falhas do catálogo aparecem separadamente e não sobrescrevem mensagens de instalação. Na verificação desta tarefa, o catálogo remoto retornou HTTP 404.

## Pacotes locais

- Scrapling: 0.4.15, integração 2, sem nova versão do projeto na consulta realizada.
- Obscura: pacote oficial 0.2.4 preparado e validado localmente. SHA-256 `8e5428bf8c101f1439c53a9dcb52d7d09bb22599206b49f6420028d93d01189b`, conferido contra o digest do asset oficial.
- O catálogo local em `public/engine-bundles` oferece o Obscura 0.2.4. O script de preparação também usa 0.2.4 como padrão. Essa pasta é gerada e ignorada pelo Git; o workflow de motores prepara os pacotes para distribuição. Não houve publicação de catálogo remoto nesta tarefa.
- No perfil pessoal, Obscura continua instalado em 0.2.3 e desativado. O novo pacote aguarda o clique do usuário; a validação usou um perfil temporário.

## Validação

27 testes Jest passaram: atualização manual dos dois motores, pacote com mesma versão e integração nova, anúncio sem pacote/HTTP 404, verificação separada, downgrade, integridade, rollback, espera pelo motor e proxy.

O Obscura oficial passou em checksum, `--version`, fixture DOM/JavaScript e teste do runtime Electron do Ghost com proxy limitado e extração de HTML de example.com. O Scrapling passou no mesmo teste de protocolo/execução. Não foram usados logins ou bibliotecas pessoais nesses testes.

O componente real do painel foi testado no navegador com API simulada, incluindo instalação de ambos, verificar sem atualizar, atualização sem pacote, versão atual, instalação inicial, revisão da mesma versão, motor ocupado e largura de 390 px. Evidências locais em `.system_generated/tasks/engine-update-panel/`.

TypeScript, ESLint do painel/tipos e build aprovados. O build mantém os avisos existentes de chunks grandes.

Fontes: [Scrapling 0.4.15](https://github.com/D4Vinci/Scrapling/releases/tag/v0.4.15), [Obscura 0.2.4](https://github.com/h4ckf0r0day/obscura/releases/tag/v0.2.4).
