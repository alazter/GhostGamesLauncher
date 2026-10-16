# Motores de coleta de Lançamentos

A engrenagem **Coleta de dados**, no cabeçalho de Lançamentos, permite escolher Electron (padrão), Preferir Scrapling ou Preferir Obscura. A preferência fica no localStorage e no configStore junto dos filtros existentes e acompanha a navegação, a paginação e a abertura de detalhes dessa tela. Trocar de motor atualiza a consulta mutável, sem invalidar o histórico anual finalizado.

## Fluxo

1. O calendário anual e o cache habitual são consultados antes da rede. A política de retenção está em `RELEASES_ANNUAL_CALENDAR.md`.
2. Electron mantém o comportamento anterior: catálogo em documento isolado, detalhes via sessão e Obscura opcional como alternativa de transporte.
3. Scrapling e Obscura preferidos consultam a página pública pelo motor habilitado e instalado. Nenhuma seleção ativa um motor globalmente. Pacotes antigos sem a capacidade nova continuam funcionando nas integrações antigas.
4. As respostas passam pelo mesmo parser, recuperação adaptativa do Scrapling e validação de região, datas, identidade e perdas suspeitas. Só resultados validados entram no arquivo anual ou no histórico protegido.
5. Motor indisponível, incompatível, erro comum de transporte ou documento inválido permitem retornar ao coletor padrão. O catálogo mostra um aviso em português quando usa essa alternativa. Uma falha de acesso/HTTP 403 ou 429/verificação interrompe essa consulta e preserva os dados salvos, sem encadear tentativas para resolver o desafio.

Busca e seleção UK no catálogo conservam a interação Electron: não foi inventado um endpoint ou uma região em uma resposta US. Detalhes trazem `RegionId` explícito e podem usar o motor escolhido também para UK. As atualizações de monitorados executadas fora dessa tela conservam o fluxo existente.

## Scrapling

`scripts/engines/release_page.py` adiciona `release-page-v1`, exclusivo para GET de calendário, populares e detalhes públicos do Releases.com. Usa Fetcher, timeout limitado, uma tentativa, TLS verificado, redirecionamentos desativados e o proxy local autenticado já restrito aos domínios da integração. Não usa a operação manual de DRM e não exporta cookies de login. API consultada na [documentação oficial de HTTP do Scrapling](https://scrapling.readthedocs.io/en/beta/fetching/static.html).

O pacote Scrapling 0.4.15 passa à integração 5. Seu teste de instalação exige `release-page-v1`, além das capacidades anteriores. O pacote local foi recompilado e testado: SHA256 `5f8bf370d83f3534b6853d0a5bbebc183d0733eba3d61a8635f3b36d81e94ead`. Catálogo e ZIP ficam em `public/engine-bundles`, que é gerado/ignorado pelo Git; `prepare_engines.py` e o workflow existente permitem regenerar o pacote. Não houve publicação remota.

## Verificação

- 131 testes em 20 suítes: Lançamentos e gerenciador de motores, incluindo histórico anual, escolha de transporte, resposta inválida, falha dos dois transportes, recusa de acesso, compatibilidade de pacotes antigos e instalação da integração 5.
- TypeScript e compilação de produção passaram. Lint dos módulos novos e dos coletores sem erros; os arquivos antigos mantêm avisos já existentes.
- Interface real em Electron oculto com catálogo simulado: três opções, persistência em localStorage e configStore após recarregar, PC + PC (Early Access) preservados e nenhuma exceção do renderer. Menu conferido nos temas claro e escuro; largura do controle explicitamente isolada do CSS global de `details`.
- Executáveis reais em perfil temporário separado: Scrapling coletou dois jogos de 25/09/2026 (PC), resposta de 5.993 bytes, sem abrir uma BrowserWindow de coleta. Obscura recebeu uma página `Just a moment` do Releases.com. Isso confirma a limitação de acesso dessa fonte; não demonstra sucesso de coleta pelo Obscura. Os testes de parser impedem que essa página entre como catálogo válido.
- Processo, contas, sessões e biblioteca do usuário não foram alterados. Aprovação visual do usuário pendente.
