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

## 18/10/2026 — Obscura 0.2.5 e atualização pela origem oficial

Causa reproduzida: o endpoint do catálogo Ghost `engines-stable/catalog.json` responde HTTP 404. O anúncio oficial 0.2.5 era mostrado, mas o candidato continuava 0.2.4 e o botão de instalar a atualização ficava desabilitado.

Para Obscura Windows x64, a consulta agora seleciona também o asset oficial estável `obscura-x86_64-windows.zip` da API GitHub do próprio projeto, exigindo URL exata, SHA-256 oficial e tamanho permitido. Releases preliminares, rascunhos, outros sistemas/arquiteturas e metadados sem digest não são candidatos. O pacote é baixado pelo mesmo caminho com limites e hash; antes de ativar, passa em versão e em uma página local controlada que verifica navegação, JavaScript e DOM com os argumentos de fetch usados pelo Ghost. A referência anterior permanece se o teste falhar. Scrapling continua dependendo do pacote de integração aprovado pelo Ghost.

A descoberta verificada é salva em `source-engines/obscura-release.json`, tornando o candidato disponível depois de reiniciar. Compartilhamentos .ghost de Obscura também podem ser confirmados contra a release oficial por versão quando o catálogo Ghost está fora do ar. Isso não permite que o próprio arquivo aprove seu hash/executável.

O pacote local gerado foi atualizado para 0.2.5 e o padrão do script de preparação acompanha essa versão. SHA-256 oficial: `9e56fa1cc1f9e4fb78926f7e9f36c40166b65177541ad7b7fd9645944c49174e`, 68.838.060 bytes. A instalação pessoal foi preservada em 0.2.4, desativada; ela não foi substituída durante os testes.

Validação: 55 testes passaram, incluindo catálogo HTTP404 com atualização oficial instalável, cache depois de reiniciar, integridade e metadados, falha de compatibilidade e compartilhamento. Teste nativo separado comprovou 0.2.4 → 0.2.5 com dados/preferência preservados, execução pelo Ghost após reiniciar e restauração 0.2.4. Painel real renderizado e botão de atualização exercitado com HTTP404. TypeScript e lint dos módulos alterados passaram. Evidências locais: `.system_generated/tasks/obscura-update/`.

Uso: reiniciar o Ghost com a correção, abrir Plugins → Motores de navegação e leitura, clicar em Verificar atualizações e em Instalar atualização 0.2.5.

Fonte: [Obscura 0.2.5 oficial](https://github.com/h4ckf0r0day/obscura/releases/tag/v0.2.5).
Build final de produção concluído com sucesso em 18/10/2026; permanecem os avisos existentes de chunks grandes e importações. O botão da atualização foi confirmado no componente real mesmo com HTTP404 do catálogo Ghost. Nenhuma publicação remota foi feita.
