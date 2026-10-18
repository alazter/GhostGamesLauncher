# Compartilhar plugins em .ghost

Na página **Plugins**, clique em **Compartilhar** no cartão de um plugin instalado e escolha onde salvar. O arquivo gerado já tem a extensão `.ghost`.

Envie esse arquivo ao destinatário pelo meio que preferir. No Ghost dele, clique em **Instalar plugin ou motor (.ghost)** e selecione o arquivo. Também é possível arrastá-lo para a página Plugins. Não é necessário extrair o pacote. Ambos precisam de uma versão do Ghost compatível com o plugin.

O pacote inclui o manifesto, o código e os recursos da pasta do plugin instalado. O armazenamento de execução do Ghost (`plugins_data`), o estado de ativação e as configurações globais não são exportados. Contas e configurações necessárias devem ser definidas pelo destinatário. Arquivos pessoais inseridos manualmente na própria pasta do código do plugin fazem parte dessa pasta; não coloque credenciais nela.

O compartilhamento salva um arquivo local: não publica nem envia automaticamente. A instalação reutiliza o gerenciador existente e identifica o plugin pelo ID do manifesto, sem criar uma segunda entrada do mesmo ID. Compartilhar funciona também com plugins desativados. Cancelar o diálogo não altera a instalação.

Links simbólicos/junções dentro do pacote são recusados para não copiar arquivos externos. A extração recusa caminhos que escapem da pasta de destino, inclusive pastas vizinhas com o mesmo prefixo.

Validação automatizada: exportação e instalação em outro perfil, preservação dos recursos, exclusão do armazenamento pessoal, cancelamento, ID inexistente e caminhos externos, junto das regressões de instalações existentes.

## Motores de navegação e leitura

Em **Plugins → Motores de navegação e leitura**, cada motor instalado (Scrapling ou Obscura) tem **Compartilhar (.ghost)**. O destinatário usa **Instalar motor compartilhado (.ghost)**. O botão geral **Instalar plugin ou motor (.ghost)** e o arrastar/soltar também reconhecem os dois tipos.

O .ghost de motor leva os metadados de compatibilidade e o ZIP original completo, incluindo executável e dependências. Nenhum caminho da máquina do remetente é necessário no destino. Não inclui a pasta `source-engines/<motor>/data`, cookies ou sessões. O destinatário recebe uma instalação própria, testada e ativada depois do sucesso. A preferência global de atualização automática do destinatário é mantida.

Antes de executar o motor, o importador confere plataforma, arquitetura, versão mínima do Ghost, protocolo, revisão da integração e SHA-256. O hash e o executável precisam corresponder ao catálogo aprovado do Ghost ou a uma versão já aprovada/instalada nesse perfil. Se o catálogo local ainda não conhece o pacote, o Ghost consulta o catálogo oficial: neste caso é necessária internet. Pacotes já conhecidos podem ser instalados inteiramente a partir do arquivo recebido. Uma versão mais antiga não substitui uma mais recente.

Extração e teste ocorrem antes de ativar a nova versão. Uma falha mantém a referência anterior. Quando o motor está ocupado, o Ghost pede para tentar novamente a importação, evitando perder o conteúdo do arquivo em uma atualização agendada. O ZIP aprovado fica em `source-engines/packages` para compartilhar novamente ou reparar sem depender da pasta do remetente.

O formato do motor usa o identificador `GHOST-ENGINE/1`, tamanho delimitado dos metadados e o ZIP original sem recompressão, mantendo o checksum aprovado. Os limites existentes de arquivo, extração e links continuam aplicados. Plugins comuns continuam usando seu formato ZIP .ghost existente.

Validação iniciada em 17/10/2026: executáveis reais Scrapling 0.4.15 (integração 5) e Obscura 0.2.4 no Windows x64, exportação de um perfil temporário e instalação em outro com apenas catálogo local; ativação e reabertura; Scrapling leu um catálogo controlado através do Ghost; Obscura respondeu pelo executável real através de withSourceEngine; ambos foram exportados novamente pelo cache do destinatário. Esse teste não representa navegação bem-sucedida em todos os sites pelo Obscura. Script reproduzível: scripts/engines/sharing_smoke.ts. A interface real do painel foi renderizada e os botões/retornos foram conferidos em larguras de 1100 e 560 pixels.

Resultado final (18/10/2026): 53 testes de regressão aprovados (motores, validação de pacotes e roteamento da instalação), TypeScript e lint dos módulos/testes dos motores aprovados; build de produção concluído com os avisos existentes de chunks/importações. O teste nativo final encerrou com código 0, após ajustar a limpeza para preservar os arquivos do perfil ainda abertos pelo Electron. A exclusão posterior de uma pasta temporária foi bloqueada pela revisão automática; os perfis diagnósticos restantes foram preservados. Nenhum perfil pessoal foi usado.

Para Obscura Windows x64, a confirmação de um .ghost também consulta a release oficial por versão no GitHub quando necessário. Exige os mesmos metadados/digest oficiais e executa o teste de compatibilidade antes da ativação; não depende exclusivamente do catálogo Ghost indisponível. Referência: docs/SOURCE_ENGINE_UPDATES.md (18/10/2026).
