# Edição manual do DRM — 17/10/2026

Nos detalhes de um jogo em **Lançamentos**, o quadro **DRM · versão PC** oferece **Editar status**. O usuário escolhe o status e clica em **Salvar status**. **Voltar ao automático** remove a escolha e restaura o resultado calculado pelas fontes.

A escolha manual tem prioridade no quadro, no badge do card e na contagem da verificação geral. A interface identifica **Definido pelo usuário**, informa a data da edição e mantém visível o resultado automático original, inclusive **Fontes divergem**. Editar não cria evidência nem altera o status atribuído a cada fonte.

Cada escolha é salva separadamente em `userData/releases/drm-overrides`, vinculada ao ID e ao título completo do jogo. Sobrevive ao reinício e à rotação do cache de consultas. Salvar não consulta os provedores. Erros de gravação são exibidos sem descartar o rascunho. Respostas de consultas anteriores não apagam uma edição mais recente.

**Quebra relatada** e **Sem DRM** escolhidos manualmente encerram consultas automáticas. Os demais estados continuam permitindo verificações. **Atualizar** e **Verificar DRM** podem consultar novamente as fontes, preservando a escolha até o usuário removê-la.

## Acesso às fontes com participação do usuário

Nos detalhes, clicar em **HizSearch** ou **SkidrowReloaded** abre uma janela identificada, centralizada e inicialmente em primeiro plano. O usuário pode concluir o desafio. O Ghost repete somente a fonte selecionada na mesma sessão persistente e valida o conteúdo correspondente ao jogo; as demais fontes e a escolha manual são preservadas.

Não basta a janela carregar ou o desafio desaparecer. No HizSearch, o campo deve estar disponível e a consulta deve retornar o título correspondente. Uma listagem não confirma quebra. No SkidrowReloaded, o anúncio precisa passar pelas validações documentadas em [DRM_BOLTGUN_2.md](DRM_BOLTGUN_2.md). Fechamento, prazo excedido, jogo diferente e restrição mantida resultam em erro ou aviso, sem fabricar confirmação.

O experimento de sessão interativa do AnkerGames não foi incluído: o teste continuou recebendo HTTP 429/Cloudflare 1015. Seu link permanece externo e a consulta geral conserva o fluxo anterior. Não existe garantia de disponibilidade permanente das fontes.

## Validação

84 testes de DRM em 14 suítes aprovados, além de TypeScript e lint dos módulos alterados. Incluem persistência e reinício, remoção da escolha, concorrência com consulta anterior, validação da identidade, atualização de uma única fonte e encerramento da janela. O teste da interface em Electron isolado validou salvar, cancelar, erro e nova tentativa, atualização do badge, retorno ao automático e larguras de 800 e 360 pixels.

No teste real de Boltgun 2, a primeira janela não apareceu para o usuário. Após centralizar, fixar o título e trazer a janela ao primeiro plano, o usuário respondeu **“Apareceu e concluí”**. A execução final leu o jogo no HizSearch e o anúncio RUNE no SkidrowReloaded, preservou a escolha manual durante ambas as consultas e, ao removê-la, retornou ao resultado automático `cracked`. Evidência local: `.system_generated/tasks/drm-access-trial/final-result.json`; validação da interface: `.system_generated/tasks/drm-edit/ui-result.json`. Perfis isolados; nenhum jogo baixado. A confirmação de participação no desafio não representa aprovação visual da funcionalidade completa.

Compilação completa e empacotamento local concluídos em `dist/drm-status-edit/win-unpacked/Ghost Games Launcher.exe`, sem publicar release nem substituir o executável anterior. A inspeção de `resources/app.asar` confirmou editor no renderer, métodos IPC no preload/backend, armazenamento de overrides e sessão persistente do Skidrow. Evidência: `.system_generated/tasks/drm-edit/package-result.json`. Para testar, abrir esse executável explicitamente; reabrir um pacote antigo não carrega as alterações. As sessões temporárias do teste de CAPTCHA não foram copiadas para o perfil pessoal.
