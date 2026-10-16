# Arquivo anual do calendário

## Comportamento — 16/10/2026

O calendário do ano corrente usa um arquivo local próprio de janeiro a dezembro, preenchido na primeira consulta de cada período. Não há varredura de centenas de páginas ao abrir o Ghost. Depois de salvo e confirmado após o dia do lançamento, o conteúdo histórico é reutilizado do disco mesmo após reiniciar, passar o prazo de cinco minutos ou solicitar atualização geral.

Hoje e os lançamentos futuros continuam com atualização normal. Ao passar a data de um título, uma cópia capturada antes ou durante o lançamento recebe uma última verificação antes de ser congelada. Estimativas, grupos sem confirmação e páginas vazias continuam atualizáveis; um trimestre estimado encerrado não prova que seus títulos foram lançados.

Anos anteriores, anos seguintes, buscas e populares mantêm a política anterior. A identificação do ano e dos dias usa a data local do aplicativo, sem ano fixado no código.

## Persistência e consultas

- `src/backend/releases/calendarCache.ts`: dados em `userData/releases/calendar/<ano>/<hash>.json`, com substituição atômica e uma cópia anterior recuperável. As páginas anuais não são descartadas pelo limite de 120 registros do arquivo temporário.
- As chaves diárias separam categoria, filtros de versão/gênero e região. São derivadas dos filtros efetivamente presentes no endereço da fonte, inclusive nos cursores.
- Grupos diários completos, sem estimativas, podem ser usados por outra consulta do mesmo escopo. Se um dia já apareceu na página inicial, a navegação histórica pode recuperá-lo sem requisitar novamente esse dia. Seus vizinhos vêm dos grupos observados e dos cursores reais da fonte.
- Páginas mistas conservam as datas históricas já finalizadas e substituem as datas mutáveis. Não congelam títulos futuros com dados obtidos antes do lançamento.
- O arquivo temporário existente continua compatível e pode alimentar o arquivo anual ao acessar um período histórico. Não é necessário apagar ou reescrever o histórico pessoal.
- Arquivos inválidos tentam recuperar a cópia anterior e não entram como calendário válido. Bloqueios transitórios de substituição no Windows têm tentativas limitadas, sem apagar o destino existente.

O arquivo anual é um cache local derivado. O backup existente continua contendo o arquivo de proteção original e os monitorados; não passa a enviar todas as cópias anuais à nuvem. As imagens seguem o cache de imagens habitual. Não há promessa de todas as capas disponíveis offline antes de terem sido abertas.

## DRM

A leitura do catálogo salvo não modifica a consulta ou a persistência do DRM. O botão geral, a consulta individual, a repetição automática de status pendentes e a parada após confirmação continuam independentes do arquivo anual.

## Verificação

- Todos os 116 testes de Lançamentos passaram após o reforço de substituição atômica e a integração dos coletores opcionais, incluindo DRM, parser, preferências, proteção de dados e persistência. Junto dos testes do gerenciador de motores: 131 testes em 20 suítes. TypeScript e compilação de produção passaram.
- Regressões específicas cobrem intervalo janeiro–dezembro, data atual/futura, estimativas, dados sem data, virada de ano, preservação de histórico em páginas mistas, uma verificação final após o lançamento, isolamento de filtros/região, reutilização de dias entre consultas, recuperação de arquivo e permanência após exceder os 120 registros temporários.
- Electron real com PC e PC (Early Access), em perfil isolado: período de 25/09 carregou três jogos com uma consulta à fonte; repetir a chamada usou zero consultas adicionais. Após encerrar e reabrir o processo, duas chamadas com atualização solicitada abriram do disco com zero consultas à fonte.
- Dados, sessões, processo e arquivos pessoais do usuário preservados. O teste real não percorreu todos os dias do ano; a retenção anual e seus limites foram exercitados por testes de política e arquivos em disco.
