# Endereços alternativos e motores das fontes

## Uso no Ghost

Em **Plugins → Plugins instalados → Configurar**, cada uma das seis fontes nativas permite cadastrar até oito endereços HTTPS adicionais, testar e escolher o preferido. O original permanece disponível. O teste reconhece o catálogo, mas não autentica a identidade de um domínio: use endereços anunciados pelo próprio site.

Os endereços são gravados separadamente dos arquivos dos plugins, em `source-addresses.json` no diretório de dados do Ghost. Uma atualização do plugin não os remove. A busca tenta alternativas quando uma origem falha e mantém os IDs de páginas no domínio original. Login e navegação assistida também aceitam os endereços cadastrados. Cookies permanecem sob as regras de domínio do navegador; não se copiam credenciais para o endereço novo.

As tarefas de download e as referências TorBox mantêm suas identidades. Links assinados de arquivos não são convertidos para outro domínio. A origem que respondeu pode ser preferida por cinco minutos; depois o endereço configurado volta a ser tentado primeiro.

Em **Plugins → Motores de navegação e leitura**:

- **Scrapling**: leitura adaptativa dos catálogos das seis fontes nativas, em um processo isolado, sem cliente HTTP. Recebe HTML obtido pelo Ghost, salva referências de seletores e valida os caminhos aceitos por cada fonte. Esta primeira integração não interpreta automaticamente qualquer mudança de página de login, versão ou botão de download.
- **Obscura**: desativado por padrão, experimental para obter HTML de catálogos públicos quando a leitura normal falha. Usa um proxy local temporário, autenticado e limitado aos domínios autorizados. As janelas Electron continuam responsáveis por login e confirmação de download; as sessões não são transferidas ao Obscura.
- **Atualizar automaticamente versões compatíveis**, **Verificar atualizações**, **Instalar/Atualizar**, **Verificar instalação** e **Restaurar versão anterior**.

Os pacotes iniciais foram preparados para **Windows x64**, com Scrapling 0.4.15 e Obscura 0.2.3. O navegador existente permanece disponível nas demais plataformas.

## DNS

`app.configureHostResolver` é chamado após `ready`, antes da inicialização dos plugins, com Quad9 DoH em modo `secure`. O backend usa `net.resolveHost` por meio do dispatcher do Undici; os endereços retornados são validados antes da conexão. O fallback de catálogo via curl recebe os endereços resolvidos e não segue redirecionamentos sem validação. O proxy experimental resolve os destinos pelo mesmo serviço. O Scrapling recebe HTML e não precisa resolver sites.

Não há fallback silencioso para DNS sem criptografia neste caminho. Uma falha do resolvedor produz erro recuperável. Quad9 não é proxy dos arquivos: o conteúdo continua sendo transferido do servidor de origem.

## Atualizações e restauração

O aplicativo consulta diariamente os lançamentos oficiais e o catálogo aprovado `engines-stable/catalog.json` no repositório Ghost. A versão publicada pelo projeto e a versão aprovada aparecem separadamente. São aceitos somente pacotes com plataforma, arquitetura, protocolo, versão mínima do Ghost, endereço autorizado e SHA-256 válidos.

A atualização é preparada em uma pasta separada, extraída com restrições de caminho/tamanho e testada antes de substituir a referência ativa. Há exclusão mútua por motor; uma atualização solicitada durante uso aguarda o término. A versão anterior fica disponível. Uma falha de leitura de site não provoca regressão do motor; a restauração automática depende de falha no autoteste do executável. O pacote rejeitado não volta a ser instalado automaticamente.

As regras declarativas dos sites (caminho de catálogo, prefixo e seletor) também podem vir pelo catálogo aprovado, com validação e versão própria, sem executar JavaScript recebido do catálogo. Alterações mais profundas ainda exigem atualização da integração.

## Preparar os pacotes

Os executáveis gerados ficam em `public/engine-bundles/`, fora do Git. `electron-builder` os inclui como recursos separados no Windows. O hook `scripts/engines/beforePack.cjs` verifica os hashes dos pacotes locais ou obtém o catálogo aprovado quando não existem pacotes locais.

Para reconstruir em um ambiente Python isolado Windows x64:

```powershell
python -m venv .engine-build
.engine-build/Scripts/python.exe -m pip install scrapling==0.4.15 pyinstaller==6.19.0
.engine-build/Scripts/python.exe scripts/engines/prepare_engines.py
```

O script empacota Python e as dependências do Scrapling, inclui licenças, verifica o digest oficial do Obscura e testa mudanças de seletores e execução JavaScript. O usuário final não precisa instalar Python. O teste `scripts/engines/runtime_smoke.ts` usa um perfil descartável e valida os executáveis através da integração real do Electron, incluindo Quad9 e proxy.

## Publicação automática

`.github/workflows/source-engines.yml` consulta versões estáveis diariamente. Alterações disparam verificações TypeScript, testes dos plugins, preparação dos pacotes e teste de integração com Electron. Somente depois do sucesso publica o arquivo do Scrapling e, por último, o catálogo aprovado. Os arquivos do Obscura continuam vindo de sua release oficial.

O workflow precisa estar publicado na branch padrão, com GitHub Actions e permissões de publicação disponíveis. Criar o arquivo localmente não ativa a rotina remota. As releases `engines-*` são pré-releases auxiliares e são excluídas da seleção de atualizações do launcher.

## Limites da validação

Testes locais não comprovam compatibilidade com todos os estados de autenticação e todos os sites reais. Não foi solicitado nenhum torrent nem iniciado download de jogo para validar esta implementação. Mudanças grandes nos sites ainda podem exigir confirmação manual ou ajuste das regras.
