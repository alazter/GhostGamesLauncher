# Downloads e instalação em outros computadores — 21/10/2026

## Formatos e descompactadores

ZIP comum continua com leitor interno. RAR, 7Z, ZIP com compressão especial ou
criptografia e os demais formatos já reconhecidos usam preferencialmente 7-Zip.
RAR também pode ser listado e extraído pelo UnRAR/RAR que acompanha o WinRAR,
sem abrir uma janela. O console RAR tem suporte diferente do programa gráfico
WinRAR ([documentação do fabricante](https://www.win-rar.com/cmd-shell-mode.html?L=1)).
Esta integração usa o console apenas para RAR. Para 7Z, instalar o 7-Zip.

`archiveTools` procura PATH, 7zz, ProgramFiles/ProgramW6432/ProgramFiles(x86),
instalação por usuário, Scoop e caminhos do Registro, incluindo outra unidade.
Ausência não é armazenada em cache: instalar a ferramenta e tentar novamente
funciona sem reiniciar o Ghost. Não distribui ou instala WinRAR/7-Zip junto com
os plugins. Nenhuma ferramenta é invocada por shell. As operações ocultam a
janela de console e fecham stdin para evitar aguardar uma senha invisível.

O leitor compartilhado valida nomes, links, duplicatas, tamanhos e limites
antes de extrair. O leitor do UnRAR aceita metadados técnicos em inglês e
português; saídas não reconhecidas são recusadas com orientação para 7-Zip.
Falhas são apresentadas em português e não incluem comando ou senha. A verificação
de espaço para atualização usa o mesmo leitor que a extração. Pacotes que contêm
somente um instalador setup.exe continuam exigindo o procedimento desse instalador.

Uma importação após falha pode remover somente a pasta temporária da própria
tarefa, com caminho e realpath validados. Preserva o pacote escolhido, recusa
apagar a pasta se o pacote estiver dentro dela, e não altera uma instalação
anterior. Corrige o bloqueio por “Uma extração anterior já existe” ao importar
outro arquivo depois de uma extração parcial.

## Aprendizado e padrão distribuído

As duas receitas Anker aprovadas no uso local agora entram no aplicativo como
dados genéricos. Não são uma cópia do perfil, das credenciais ou dos cookies.
Receitas aprendidas localmente substituem os padrões. Depois de duas falhas,
o padrão fica desativado inclusive após reiniciar. Uma nova sequência manual
bem-sucedida o substitui. Não há expiração arbitrária de controles estáveis.

O download completo com metadados de pacote válidos pode ensinar antes da
instalação. Antes, uma falha na extração/seleção de executável impedia que o
aprendizado fosse salvo, mesmo após receber o arquivo corretamente. O caminho
de confirmação após extração continua como alternativa. Os controles continuam
restritos à origem permitida, correspondência única e visível e cliques nativos
na confirmação manual. Login, CAPTCHA, pagamentos e domínios desconhecidos não
se tornam receitas automáticas.

É necessário atualizar o aplicativo Ghost nos outros computadores. Compartilhar
apenas um plugin .ghost com uma versão antiga do programa não entrega estas
alterações no controlador de download e no instalador.

## Retomada do TorBox

Pausar/Retomar mantém o torrent remoto e obtém um link novo, sem reenviá-lo.
A transferência local usa Range/If-Range e exige a mesma identificação forte
do arquivo (ETag) e o mesmo tamanho total. Se o servidor ignora Range e devolve
o arquivo inteiro, a transferência reinicia do zero; não mistura os dados.

Downloads paralelos mantêm package.ext.resume.json com tamanho, ETag e fim do
prefixo contínuo. O arquivo é sincronizado antes de gravar o marcador por troca
atômica. Após falha ou reinício, o Ghost descarta as partes fora de ordem e
continua apenas do ponto confirmado. Um tamanho grande no disco não é prova de
que o download terminou. Metadados incompatíveis não autorizam reaproveitar bytes.
Um pacote integral com marcador confirmado pode seguir para extração sem novo
download. Links assinados e tokens de API não são gravados nesse marcador.

## Verificação e cópia de teste

- TypeScript e lint dos leitores, aprendizado e retomada passaram.
- 239 testes em 16 suítes passaram: extração/segurança/senha, regras padrão,
  persistência/reaprendizado, instalação, recuperação manual, TorBox, blocos
  paralelos, retomada após reiniciar e proteção contra revisão diferente.
- Electron com perfil limpo, páginas controladas, preload minificado e cliques
  nativos comprovou o ciclo padrão/manual/automático/mudança/manual/automático.
- Extração real de ZIP, 7Z e RAR com 7-Zip, mais listagem validada e extração RAR
  pelo UnRAR instalado com WinRAR. Arquivos de teste, sem instalar um jogo real.

Provas e configuração isolada: `.system_generated/tasks/portable-install-learning/`.
Distribuição de teste: `dist/ghost-downloads-20261021/`, versão 0.3.8-beta,
sem publicação. A instância e os dados pessoais permanecem preservados.
Os computadores dos amigos ainda precisam ser testados com esta cópia atualizada.

Empacotamento concluído e verificado: `dist/ghost-downloads-20261021/Ghost Games Launcher-0.3.8-beta-Portable-x64.exe` (337.581.057 bytes). Conferidos manifesto, entrada, módulos novos no backend, recursos, preloads, dependências e hashes dos dois motores. O preload de aprendizado dentro de app.asar é idêntico ao preload de produção testado no Electron limpo. Hashes do pacote em `.system_generated/tasks/portable-install-learning/package-proof.json`. Fechar a instância anterior antes de abrir a cópia portátil, inclusive nos computadores dos amigos. Não substitui o executável da distribuição anterior.

A cópia de teste posterior `dist/ghost-engine-learning-20261021/Ghost Games
Launcher-0.3.8-beta-Portable-x64.exe` (337.583.930 bytes) preserva estas correções e
acrescenta o aprendizado compartilhado pelos motores. Usar essa cópia atualizada
para o teste conjunto. Sua revisão Scrapling é 6; conferir a atualização em
Motores de navegação se a atualização automática estiver desativada. Resultados e
limites em [DIRECT_DOWNLOAD_ENGINES.md](DIRECT_DOWNLOAD_ENGINES.md).
