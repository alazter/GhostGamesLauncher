# Nuvio Media Player & Addon (`com.nuvio.player.addon`)

Plugin independente para o **Ghost Launcher** e Addon oficial para a sessão **Stremio** do **Alazterflix** (`com.ghost.alazterflix`).

## Funcionalidades Integradas ao Alazterflix (Mídias Locais & Sessão Stremio)
1. **Reprodutor Completo do Nuvio Desktop (`NuvioVideoPlayer`)**:
   - **Pause Metadata Overlay**: Tela de metadados cinematográfica ("Você está assistindo", título/logo, episódio, sinopse e fonte) exibida em pausa.
   - **Opening Overlay**: Tela de abertura animada com arte de fundo (backdrop), título/logo e indicador canvas Bezier do Nuvio.
   - **Action Pill & Controles Nuvio**: Play/Pause com destaque, Próximo Episódio, Modo de Proporção (`Fit`, `Zoom`, `Stretch`, `Fill`), Velocidade (`0.25x` a `2x` + **Hold-to-Speed 2x** segurando Espaço ou clique), Legendas, Áudio, Fontes (Sources) e Episódios.
   - **Trilho Triplo de Legendas (3-Rail Subtitle Modal)**: Coluna 1 (Idiomas com contagem), Coluna 2 (Faixas Embutidas/Locais e Addons Stremio OpenSubtitles), Coluna 3 (Estilo customizável ao vivo: Delay `-0.1s`/`+0.1s`/`Reset`, Auto-Sync de fala, Tamanho da Fonte, Posição Vertical, Negrito, Cor do Texto, Opacidade, Contorno e Cor do Contorno).
   - **Volume Boost até 200%**: Amplificação real de áudio via Web Audio API (`GainNode`) até 200% com trilha visual de boost.
   - **Skip Intro / Recap / Outro & Marcador de Timestamps**: Botão flutuante para pular abertura/recap/encerramento e modal para capturar/salvar tempos de início e fim por episódio ou filme.
   - **Gavetas Laterais Nuvio (Sources & Episodes)**: Troca rápida de streams dos Addons Stremio filtrados por provedor e navegação por temporadas/episódios com opção de ocultar spoilers (blur em episódios não assistidos).
   - **Picture-in-Picture (PiP) & Modo Bloqueio de Controles (Lock)**.
2. **Seletor de Player nas Configurações**:
   - Permite escolher livremente entre **Nuvio Media Player (Nuvio Desktop)** e **Alazterflix Player (Padrão Cyber-Neon)** nas configurações do plugin e na barra superior do próprio player.
