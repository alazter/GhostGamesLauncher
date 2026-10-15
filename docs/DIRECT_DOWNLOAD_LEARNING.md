# Direct/DataNodes e aprendizado de downloads manuais

## Escopo — 15/10/2026

Após confirmar que a correção do AnkerGames funcionou, o usuário pediu suporte
às opções Direct e DataNodes e aprendizado quando a confirmação manual entrega
o arquivo corretamente. A automação, a janela manual e o contador aprovados
foram preservados.

O seletor Anker reconhece linhas Direct e DataNodes, inclusive links hash com
handler próprio. Direct recebe prioridade quando está presente; as demais
opções mantêm sua ordem. O portal continua sendo responsável por gerar o link
assinado. Não são construídos IDs ou URLs de download por título do jogo.

DataNodes foi incluído na resolução compartilhada, com leitura do nome do
arquivo em `input[name="fname"]` e controles de download gratuito. Formulários
mantêm POST, campos e sessão. O fluxo também cobre a opção DataNodes quando o
Anker entrega o arquivo por seu próprio download direto. O relay Anker
`tunnel5.dlproxy.uk` continua restrito ao manifesto Anker; não foi liberado um
wildcard para servidores desconhecidos.

Na inspeção real da opção DataNodes de Graveyard Keeper 2, o Anker mostrou
"Download Now" e entregou um DownloadItem por `tunnel5.dlproxy.uk`. Esse item
foi cancelado no teste; não foi instalado o jogo. Isso comprova a rota atual
do Anker, sem afirmar uma transferência real pelo servidor externo DataNodes.

## Como o aprendizado funciona

1. Ao abrir a confirmação manual, um preload dedicado observa cliques reais
   do usuário (`isTrusted`) no documento principal. Ele não expõe `ipcRenderer`,
   `require`, APIs do launcher ou acesso ao sistema à página.
2. O backend aceita mensagens somente das janelas da operação e de páginas
   permitidas. Registra descritores curtos do controle: tag, legenda,
   identificadores estáveis, tipo de formulário e nomes dos campos. Não
   registra valores dos campos, senhas, cookies, HTML ou código JavaScript.
3. O recebimento completo de ZIP/RAR/7Z com tamanho e assinatura coerentes
   prepara a instrução em memória. **Não basta chegar um DownloadItem.** A
   instrução só é promovida a conhecimento persistente depois que o instalador
   extrai o pacote, aplica o fix quando necessário e encontra o executável.
   Confirmação em `ExternalGames.prepare`; a memória provisória expira em 1h.
4. A próxima tentativa lê as regras locais e busca o mesmo controle por
   origem, formato da rota e descritor. Exige uma única correspondência visível
   e revalida link/formulário no manifesto antes de clicar. A regra armazena
   dados, nunca scripts ou o link assinado do arquivo anterior.
5. Se não corresponder ao DOM atual, segue o resolvedor normal e a confirmação
   manual. Receitas executadas sem sucesso perdem validade após duas falhas;
   regras persistidas expiram em 30 dias. Pausar/cancelar uma transferência não
   é tratado como prova de que uma instrução de clique falhou.

O aprendizado cobre AnkerGames, SteamRIP, as fontes ROM no controlador
compartilhado e as páginas de hosters do Online-Fix. Pacotes concluídos do
Online-Fix só confirmam as regras após validar jogo e fix juntos. Arquivos ROM
brutos e TAR continuam no fluxo existente, mas não ensinam por esta assinatura
de pacote. Cliques em CAPTCHA, login, denúncia, exclusão, instalação de apps,
extensões ou cópia para clipboard não viram instruções automáticas.

O armazenamento fica em `userData/external-games/direct-download-rules.json`.
Há limites de tamanho, quantidade de regras e sequência (até seis ações),
descarte de arquivo inválido e gravação atômica. Listeners de IPC e de janelas
são removidos ao encerrar, inclusive quando um filho foi fechado no fallback.

## Limites importantes do recurso

Uma hospedagem nova **já permitida pela integração** pode aprender controles
de download ainda não reconhecidos pelo resolvedor. O aprendizado não inclui
permissão automática para novos domínios, não resolve CAPTCHA e não reproduz
senhas/login. Se o layout muda, há ambiguidade ou o controle deixa de existir,
o Ghost pede confirmação novamente. Não há promessa de automação universal
após uma única visita a qualquer site.

Falhas de rede e arquivos incompletos não ensinam. Falhas de extração ou
pacotes sem executável não promovem a instrução. A sequência aprendida é local;
não é enviada a serviços externos nem a outros usuários.

## Validação

- Teste Electron do aprendizado: primeiro download exigiu uma janela manual;
  clique nativo recebido pelo preload; ZIP extraído e regra salva; segundo jogo
  com outra rota dinâmica baixou sem nova janela. Eventos sintéticos não
  contaminaram a receita. O teste foi repetido com o preload minificado do
  build de produção. Evidência: `native-release-preload.log`.
- Electron para Direct: seleção correta entre alternativas, portal Anker,
  redirect ao relay, ZIP recebido, zero janelas. Para DataNodes: seleção,
  portal, formulário POST e ZIP recebido, zero janelas. São páginas controladas
  e não uma instalação real por essas duas hospedagens: `compat.log`.
- Testes cobrem aprovação somente após extração, persistência/releitura,
  rejeição de arquivo parcial/HTML, origem/janela indevida, CAPTCHA/denúncia,
  ambiguidade, destinos não permitidos, duas falhas, JSON inválido, alteração de
  rota e descarte de listeners de uma janela filha destruída.

Artefatos em `.system_generated/tasks/direct-learning/`. A confirmação do
usuário vale para o fluxo anterior; Direct/DataNodes e o aprendizado são esta
nova implementação e ainda aguardam seu teste no uso real.

Verificação final: **182 testes em 11 suítes**, TypeScript e build isolado
aprovados; oito módulos do fluxo passaram no lint com zero erros/avisos.
