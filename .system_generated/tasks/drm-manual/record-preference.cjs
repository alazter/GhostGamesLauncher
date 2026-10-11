const fs = require('fs')
const path = require('path')
const root = 'C:/Users/alazt/Documents/GitHub/Skills/Ghost Games Launcher'
const marker = 'DRM_MANUAL_APENAS_BOTAO_20261008'
const notes = {
  'regras.md': 'O fluxo extra de navegador para AnkerGames e liberação humana do HizSearch deve ser acionado somente pelo botão geral Verificar DRM. Consultas automáticas e atualização individual permanecem no fluxo anterior. Após liberar o HizSearch, repetir somente essa fonte para o lote original, preservando demais fontes e datas. Encerrar a janela ao finalizar o lote, mantendo a sessão exclusiva salva. Manter o botão junto de Expandir calendário e persistir quebra/ausência de DRM confirmada; jogos sem quebra seguem sendo verificados.',
  'designer_interface.md': 'Liberar acesso ao HizSearch aparece apenas quando a consulta geral identifica necessidade de confirmação humana. A janela abre ao clicar nessa ação sem interromper as outras fontes. Verificar DRM permanece ao lado de Expandir calendário, com contador e interrupção. Interface validada em 1500, 1100, 900 e 650. Aprovação visual do usuário ainda pendente.',
  'erros_corrigidos.md': 'Operação restrita manual-drm-page-v1 acrescentada ao Scrapling 0.4.15, integração 2, somente no fluxo geral de DRM. Parser anterior e instalação do pacote em perfil curto validados. Incluídos dados apify_fingerprint_datapoints ausentes no primeiro pacote. Perfil de teste longo causava falha de DLL no Windows. Chromium exige HTTP 407/Proxy-Authenticate antes do CONNECT autenticado; corrigido sem resolver destinos não autenticados. AnkerGames real retornou Minecraft Dungeons II como listado/status não confirmado. HizSearch real pede confirmação humana; abertura, liberação do campo e consulta validadas com fixture, sem declarar CAPTCHA real resolvido. 82 testes de Lançamentos e 22 de motores/política/proxy aprovados, TypeScript sem erros, compilação e interface em quatro larguras aprovadas. Relatório: docs/DRM_MANUAL.md. Perfil real do usuário preservado.',
  'sistema_update.md': 'Scrapling 0.4.15, integração 2, SHA-256 184012ed21129c351ffef97cc780b32a9c2032a88940f48d8846bd5d97a0c3d5. Acrescenta manual-drm-page-v1 e conserva parsing. Pipeline instala scrapling[fetchers], inclui os dados de fingerprints e valida o executável. A consulta não instala/ativa motores nem navegadores; motor antigo ou desativado produz aviso e preserva as outras fontes.'
}
for (const [file, content] of Object.entries(notes)) {
  const target = path.join(root, file)
  if (!fs.readFileSync(target, 'utf8').includes(marker)) fs.appendFileSync(target, `\n\n## ${marker}\n\n${content}\n`, 'utf8')
}
console.log('Preferência de DRM registrada nos documentos centrais.')
