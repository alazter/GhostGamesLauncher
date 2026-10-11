# Instalações duplicadas de plugins

Correção de 11/10/2026. A sincronização dos plugins incluídos no aplicativo usava o nome da pasta (por exemplo, `steamrip-source`), enquanto a importação usava o ID (`com.ghost.steamrip-source`). Ambas apareciam habilitadas, compartilhavam estado e disputavam o mesmo host. A ordem de leitura podia selecionar uma versão antiga.

O gerenciador agora usa o ID do manifesto como pasta de instalação em todos os caminhos. Na inicialização, seleciona a maior versão semântica de cada ID, arquiva as cópias repetidas fora da pasta ativa e migra a vencedora para a pasta canônica. Na mesma versão, prefere a pasta canônica. A listagem também elimina IDs repetidos mesmo se uma migração não puder terminar. A sincronização não substitui uma versão instalada mais recente por uma versão antiga incluída no aplicativo, nem sobrescreve plugins em modo desenvolvedor.

Importações por arquivo, por buffer e por pasta removem aliases antigos do mesmo ID. Desinstalar alcança todas as pastas correspondentes ao ID. Os botões das fontes na página Plugins reconhecem uma instalação independentemente da versão, evitando oferecer novamente o pacote antigo.

As pastas antigas ficam em `plugin_installation_backups`, ao lado de `plugins` no perfil do Ghost. `plugins_data` e `plugins_state.json` são preservados pela migração. Movimentações verificam que a origem é uma pasta direta da instalação e que o backup fica fora das instalações ativas. A operação é idempotente.

Na instalação local foram conferidos **8 IDs únicos**, com as seis fontes em 1.2.0, Alazterflix em 1.3.0 e Cyber Neon em 1.0.0. As seis cópias 1.1.0 foram arquivadas. Não houve exclusão de dados pessoais dos plugins.

Validação: 19 testes de regressão cobrem versões numéricas/pré-lançamento, desempate, migração repetida, preservação de dados/estado, inicialização de um único host, atualização sem downgrade, modo desenvolvedor, importação por arquivo/buffer/pasta, desinstalação de aliases e proteção dos caminhos. Com os testes existentes do Cinema, **28 testes passaram**. TypeScript, ESLint dos arquivos novos e build aprovados. O build mantém os avisos existentes de chunks grandes.

O teste antigo de empacotamento do Cinema usava versão 1.2.0 fixa e escrevia na pasta de pacotes oficiais. Ele agora usa a versão do manifesto e uma pasta temporária. O artefato com nome 1.2.0 gerado a partir da fonte 1.3.0 durante essa verificação foi retirado da pasta de distribuição e preservado em `.system_generated/tasks/plugin-dedup/`; o pacote oficial 1.3.0 conservou seu checksum.
