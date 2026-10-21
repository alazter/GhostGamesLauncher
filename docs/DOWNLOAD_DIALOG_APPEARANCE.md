# Aparência da janela de download

“Escolha como baixar” oferece **Ghost compacto** e **Ghost com capa**. A escolha é salva em `ghost_download_dialog_layout` e compartilhada entre o pincel à direita de DOWNLOADS e o painel da lupa na prévia de Personalização. O padrão é compacto.

Ambos usam o logo oficial do Ghost e o logo da fonte selecionada. A capa segue a prioridade AnkerGames → Google → SteamGridDB, em um quadro 600:900, com a mesma imagem desfocada no fundo de vidro escuro. Essa preferência vale para Buscar jogos e para o diálogo; não altera a Biblioteca nem redimensiona o arquivo original da fonte. Consulte EXTERNAL_COVER_PRIORITY.md.

O seletor de fontes segue o mockup: menu suspenso compacto junto ao botão da fonte, com logo e nome de cada loja. Não inserir um painel de cartões na área dos métodos. O menu abre acima quando faltar espaço abaixo, acompanha rolagem/redimensionamento e fecha ao escolher, clicar fora ou pressionar Escape. Setas, Home/End e Enter permitem a escolha pelo teclado. Versão e tamanho permanecem na apresentação do jogo selecionado.

Versão, LAST UPDATE e tamanho vêm do jogo selecionado na fonte. LAST UPDATE segue `sourceDate`/`uploadDate`, nunca o dia da instalação. Quando faltam informações, a interface exibe “Data não registrada” e “Tamanho não informado”. O tamanho exibido é o pacote informado pela fonte (`size`), não uma estimativa de espaço após instalação.

Ao trocar de fonte, os metadados mudam juntos. A capa continua seguindo a hierarquia do jogo, independentemente da loja de download selecionada. Respostas assíncronas de jogos anteriores ou de diálogos fechados são ignoradas. A confirmação do método fecha a janela e abre Downloads antes de aguardar a preparação por IPC.

Validação: 12 testes de estado e envio, TypeScript e lint dos arquivos alterados, build de produção em diretório isolado; interação dos componentes reais em navegador isolado, incluindo lupa, pincel, persistência após recarga, tamanho/data/versão, troca de fonte, pasta, layout em 320/360px e envio com IPC pendente. APIs de instalação e seletor de pasta foram simuladas, sem iniciar downloads reais.
