# Recuperação da navegação histórica de Lançamentos

## Relato e reprodução — 15/10/2026

Ao subir o calendário com PC e PC (Early Access), a navegação parava no início de outubro com a mensagem “A quantidade de títulos caiu de forma inesperada”. Reiniciar não resolvia porque a mesma resposta continuava sendo comparada ao histórico persistente.

Foi lida, sem alterar o perfil pessoal, a revisão da página `Code=Y2026-Q3&Direction=Backward`: 31 títulos estimados, confirmada em 08/10/2026 às 00:32:02. Uma cópia desse registro foi usada em Electron isolado. O coletor real reproduziu a mensagem e a data exatas do relato.

A resposta atual dessa mesma página tem um título, com `Estimated Q3 2026`, sem data exata. O limite geral de queda de 60% tratava a mudança no conjunto de estimativas como corrupção. Páginas de estimativas podem perder títulos quando suas datas são definidas ou remarcadas; não constituem um conjunto fixo de lançamentos confirmados.

## Correção

- `catalogUpdateProblem` exclui da comparação de quantidade os títulos explicitamente identificados como estimativas de um período. Catálogos com datas confirmadas ou sem informações suficientes continuam protegidos contra desaparecimentos suspeitos. Validações de estrutura, identificação, região e perda de datas conhecidas permanecem ativas.
- O parser reconhece um grupo histórico explicitamente vazio, com código de dia/período e rótulo válidos, preservando seu cursor. HTML desconhecido, desafios e páginas que contêm links de títulos mas perderam a estrutura continuam rejeitados.
- “Tentar novamente” repete a página que falhou, na mesma direção, com atualização forçada. Não descarta o calendário carregado nem reinicia a consulta na data atual. Mudanças de filtros limpam o contexto da falha anterior.
- O arquivo de proteção grava a nova resposta válida e retém a revisão anterior. Nenhum histórico, monitorado, filtro ou cache do perfil pessoal foi apagado manualmente.

## Verificação

- 27 testes de calendário, parser, validação e persistência passaram. TypeScript sem erros e build completo aprovado. ESLint ainda aponta seis erros preexistentes em `NativeReleases.tsx` e `resilience.test.ts`; a correção não remove nem adiciona essas ocorrências.
- Teste de persistência com arquivo real em diretório isolado: 31 estimativas para uma, revisão antiga retida e próxima leitura do disco usando a resposta nova, sem nova chamada à fonte.
- Regressões: redução e esvaziamento de estimativas, catálogo misto, proteção de datas confirmadas, grupo vazio com cursor e rejeição de HTML inválido.
- Coletor real, sem simular a resposta do Releases.com: período Q3 desbloqueado, continuação para 30/09 (um título), 29/09 (dez títulos) e 25/09 (três títulos), todos sem aviso de dados antigos. Consulta atual de 15/10 retornou 19 títulos. Filtros PC + PC (Early Access) preservados.
- Componente NativeReleases real em Electron com API simulada: falha numa página histórica após carregar 64 títulos; retry buscou o mesmo cursor com `refresh: true`, acrescentou o título restante, manteve os 64 anteriores e a posição relativa do cartão visível. Apenas uma consulta inicial ao calendário; nenhuma reinicialização ao tentar novamente.

Os testes não percorreram todo o histórico do site. O motor adaptativo foi desativado apenas na captura isolada para observar diretamente a resposta e a validação nativas. Na aplicação, os motores e a proteção do arquivo continuam ativos.
