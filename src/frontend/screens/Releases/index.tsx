import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import flagsB64 from 'frontend/assets/flags_b64.json'
import { checkTodayReleases } from 'frontend/helpers/releasesScanner'
import './index.css'

const flagBrData = 'data:image/png;base64,' + flagsB64.br
const flagUsData = 'data:image/png;base64,' + flagsB64.us

export default function Releases() {
  const location = useLocation() as { state?: { targetUrl?: string } }
  const defaultReleasesUrl =
    'https://www.releases.com/calendar/products?f=t%3AGame&f=v%3APC&f=v%3APC%20%28Early%20Access%29'
  const releasesUrl = location.state?.targetUrl || defaultReleasesUrl

  const [lang, setLang] = useState<'pt-br' | 'en'>(() => {
    return (localStorage.getItem('ghost_releases_lang') as 'pt-br' | 'en') || 'pt-br'
  })

  const webviewRef = useRef<Electron.WebviewTag>(null)

  useEffect(() => {
    return () => {
      // Re-verifica lançamentos rastreados ao sair da aba
      checkTodayReleases()
    }
  }, [])

  useEffect(() => {
    const webviewEl = webviewRef.current
    if (!webviewEl) return
    const target = location.state?.targetUrl || defaultReleasesUrl
    if (webviewEl.src !== target && typeof webviewEl.loadURL === 'function') {
      webviewEl.loadURL(target)
    }
  }, [location.state])

  const handleLangChange = (newLang: 'pt-br' | 'en') => {
    if (newLang === lang) return
    setLang(newLang)
    localStorage.setItem('ghost_releases_lang', newLang)

    const webviewEl = webviewRef.current
    if (webviewEl) {
      webviewEl.reload()
    }
  }

  useEffect(() => {
    const webviewEl = webviewRef.current
    if (!webviewEl) return

    const handleLoad = () => {
      webviewEl
        .insertCSS(`
          /* Left Sidebar Expansion & Harmonious Dark Theme */
          aside,
          nav,
          div[class*="sidebar"]:not([class*="AtMenu"]),
          div[class*="Sidebar"]:not([class*="AtMenu"]),
          div[class*="menu"]:not([class*="AtMenu"]):not([class*="atmenu"]),
          div[class*="Menu"]:not([class*="AtMenu"]):not([class*="atmenu"]),
          div[class*="left-nav"],
          div[class*="LeftNav"] {
            min-width: 280px !important;
            width: 280px !important;
            background-color: #0d0f14 !important;
            background: #0d0f14 !important;
            border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
          }

          /* Ensure Header Date Dropdown (AtMenu) is not expanded or painted */
          .RWP-Calendar-AtMenu,
          [class*="RWP-Calendar-AtMenu"],
          [class*="AtMenu"],
          [class*="HeaderPointDropdownControl"] {
            min-width: unset !important;
            width: auto !important;
            background-color: transparent !important;
            background: transparent !important;
          }

          aside a,
          aside button,
          aside span,
          nav a,
          nav button,
          nav span,
          div[class*="sidebar"] a,
          div[class*="sidebar"] button,
          div[class*="sidebar"] span,
          div[class*="Sidebar"] a,
          div[class*="Sidebar"] button,
          div[class*="Sidebar"] span,
          div[class*="menu"] a,
          div[class*="menu"] button,
          div[class*="menu"] span,
          [class*="label"],
          [class*="text"],
          [class*="title"] {
            white-space: nowrap !important;
            word-break: keep-all !important;
            text-overflow: clip !important;
            overflow: visible !important;
          }

          /* Left Sidebar Footer & Theme Switcher -> Dark Slate */
          .RWPC-Nav-ThemeMode,
          [class*="RWPC-Nav-ThemeMode"],
          [class*="ThemeMode"],
          [class*="themeMode"],
          [class*="Theme-Mode"],
          div[class*="mode-switch"],
          div[class*="modeSwitch"],
          div[class*="theme-toggle"],
          div[class*="themeToggle"],
          aside footer,
          nav footer,
          aside div[class*="footer"],
          nav div[class*="footer"],
          aside div[class*="bottom"],
          nav div[class*="bottom"],
          aside div[class*="switch"],
          nav div[class*="switch"] {
            background-color: #0d0f14 !important;
            background: #0d0f14 !important;
            border: none !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
            box-shadow: none !important;
          }

          /* Right Sidebar & Filter Panel Boxes -> Dark Slate */
          aside:last-of-type,
          div[class*="right-nav"],
          div[class*="RightNav"],
          div[class*="Calendar-Filter"],
          div[class*="calendar-filter"] {
            background-color: #0d0f14 !important;
            background: #0d0f14 !important;
            border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
          }

          div[class*="Calendar-Filter"] div,
          div[class*="calendar-filter"] div,
          aside:last-of-type div {
            background-color: #0d0f14;
          }

          /* Central Page Main Area -> Harmonious Dark */
          main,
          div[class*="main-content"],
          div[class*="MainContent"] {
            background-color: #141721 !important;
            background: #141721 !important;
          }

          /* Exclusive Light Mode Overrides (Active ONLY when body has LightMode) */
          body[class*="LightMode"] {
            background: #f0f2f5 !important;
            background-color: #f0f2f5 !important;
          }

          body[class*="LightMode"] main,
          body[class*="LightMode"] div[class*="main-content"],
          body[class*="LightMode"] div[class*="MainContent"] {
            background: #f0f2f5 !important;
            background-color: #f0f2f5 !important;
            color: #1a1a1a !important;
          }

          body[class*="LightMode"] aside,
          body[class*="LightMode"] nav,
          body[class*="LightMode"] div[class*="sidebar"]:not([class*="AtMenu"]),
          body[class*="LightMode"] div[class*="Sidebar"]:not([class*="AtMenu"]),
          body[class*="LightMode"] div[class*="menu"]:not([class*="AtMenu"]):not([class*="atmenu"]),
          body[class*="LightMode"] div[class*="Menu"]:not([class*="AtMenu"]):not([class*="atmenu"]),
          body[class*="LightMode"] div[class*="left-nav"],
          body[class*="LightMode"] div[class*="LeftNav"] {
            background: #e8ecf0 !important;
            background-color: #e8ecf0 !important;
            border-right: 1px solid #d0d7de !important;
          }

          body[class*="LightMode"] aside a,
          body[class*="LightMode"] aside button,
          body[class*="LightMode"] aside span,
          body[class*="LightMode"] nav a,
          body[class*="LightMode"] nav button,
          body[class*="LightMode"] nav span,
          body[class*="LightMode"] div[class*="sidebar"] a,
          body[class*="LightMode"] div[class*="sidebar"] button,
          body[class*="LightMode"] div[class*="sidebar"] span {
            color: #1a1a1a !important;
          }

          body[class*="LightMode"] .RWPC-Nav-ThemeMode,
          body[class*="LightMode"] [class*="RWPC-Nav-ThemeMode"],
          body[class*="LightMode"] aside footer,
          body[class*="LightMode"] nav footer,
          body[class*="LightMode"] aside div[class*="footer"],
          body[class*="LightMode"] nav div[class*="footer"] {
            background: #e8ecf0 !important;
            background-color: #e8ecf0 !important;
            border-top: 1px solid #d0d7de !important;
          }

          body[class*="LightMode"] aside:last-of-type,
          body[class*="LightMode"] div[class*="right-nav"],
          body[class*="LightMode"] div[class*="RightNav"],
          body[class*="LightMode"] div[class*="Calendar-Filter"],
          body[class*="LightMode"] div[class*="calendar-filter"] {
            background: #e8ecf0 !important;
            background-color: #e8ecf0 !important;
            border-left: 1px solid #d0d7de !important;
            color: #1a1a1a !important;
          }

          body[class*="LightMode"] div[class*="Calendar-Filter"] div,
          body[class*="LightMode"] div[class*="calendar-filter"] div,
          body[class*="LightMode"] aside:last-of-type div {
            background: #e8ecf0 !important;
            background-color: #e8ecf0 !important;
            color: #1a1a1a !important;
          }

          body[class*="LightMode"] aside:last-of-type *,
          body[class*="LightMode"] div[class*="Calendar-Filter"] * {
            color: #1a1a1a !important;
          }

          /* Date Group Headers -> Native Original (Transparent Background) */
          .RWP-Calendar-GroupHeader,
          [class*="RWP-Calendar-GroupHeader"],
          [class*="GroupHeader"],
          .RWP-Calendar-GroupHeader *,
          [class*="RWP-Calendar-GroupHeader"] * {
            background-color: transparent !important;
            background: transparent !important;
          }

          iframe[src*="google"],
          iframe[src*="doubleclick"],
          iframe[src*="adservice"],
          iframe[src*="amazon-adsystem"],
          div[class*="ad-"],
          div[class*="-ad"],
          div[id*="ad-"],
          div[id*="-ad"],
          div[class*="banner"],
          div[class*="sponsor"],
          div[class*="promotion"],
          .ad-container,
          .adsbygoogle,
          .google-auto-placed,
          .taboola,
          .outbrain,
          .adunit,
          .ad-box,
          .ad-wrapper,
          [id*="google_ads"],
          [id*="div-gpt-ad"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `)
        .catch(() => {})

      webviewEl
        .executeJavaScript(`
          (function ghostAdBlock() {
            if (window.__ghostAdBlockInjected) return;
            window.__ghostAdBlockInjected = true;

            const adSelectors = [
              '.adsbygoogle',
              '.google-auto-placed',
              '[id*="google_ads"]',
              '[id*="div-gpt-ad"]',
              'iframe[src*="google"]',
              'iframe[src*="doubleclick"]',
              'iframe[src*="adservice"]',
              'div[class*="ad-slot"]',
              'div[class*="banner-ad"]',
              'div[class*="sponsor"]',
              '.ad-banner',
              '.adContainer'
            ];

            const purgeAds = () => {
              adSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => {
                  try { el.remove(); } catch(e) {}
                });
              });
            };

            purgeAds();
            const obs = new MutationObserver(purgeAds);
            if (document.body) {
              obs.observe(document.body, { childList: true, subtree: true });
            }
          })();
        `)
        .catch(() => {})

      if (lang === 'pt-br') {
        webviewEl
          .executeJavaScript(`
            (function translatePageToPtBR() {
              const dict = [
                ['Hot', 'Populares'], ['hot', 'populares'], ['HOT', 'POPULARES'],
                ['- less', '- menos'], ['-less', '- menos'], ['- Less', '- menos'],
                ['Todos products', 'Todos os Produtos'], ['todos products', 'todos os produtos'],
                ['Movies & TV series', 'Filmes & Séries'], ['Movies & TV Series', 'Filmes & Séries'],
                ['Game Consoles', 'Games Consoles'], ['Game consoles', 'Games Consoles'],
                ['Board Games', 'Jogos de Tabuleiro'], ['Boardgames', 'Jogos de Tabuleiro'],
                ['Albums', 'Álbuns'], ['albums', 'álbuns'],
                ['Tracking', 'Rastreamento'], ['tracking', 'rastreamento'],
                ['Profile', 'Perfil'], ['profile', 'perfil'],
                ['Log out', 'Sair'], ['Log Out', 'Sair'], ['log out', 'sair'],
                ['Fantasy', 'Fantasia'], ['fantasy', 'fantasia'],
                ['Versions', 'Versões'], ['versions', 'versões'],
                ['Specials', 'Especiais'], ['specials', 'especiais'],
                ['All', 'Todos'], ['all', 'todos'],
                ['Graphics Card', 'Placa de Vídeo'], ['Graphics card', 'Placa de vídeo'], ['graphics card', 'placa de vídeo'],
                ['Collectibles', 'Colecionáveis'], ['collectibles', 'colecionáveis'],
                ['Monitors', 'Monitores'], ['monitors', 'monitores'],
                ['Laptops', 'Laptops'], ['laptops', 'laptops'],
                ['Events', 'Eventos'], ['events', 'eventos'],
                ['Mixed Reality Headsets', 'VR - Headset'], ['Mixed reality headsets', 'VR - Headset'], ['mixed reality headsets', 'VR - Headset'],
                ['Realidade Mista Headsets', 'VR - Headset'], ['Realidade Mista Headset', 'VR - Headset'], ['Realidade mista headsets', 'VR - Headset'],
                ['Mixed Reality', 'Realidade Mista'], ['Mixed reality', 'Realidade mista'], ['mixed reality', 'realidade mista'],
                ['Books', 'Livros'], ['books', 'livros'],
                ['Processors', 'Processadores'], ['processors', 'processadores'],
                ['Televisions', 'Televisores'], ['televisions', 'televisores'],
                ['Today', 'Hoje'], ['today', 'hoje'], ['TODAY', 'HOJE'],
                ['Tomorrow', 'Amanhã'], ['tomorrow', 'amanhã'],
                ['Yesterday', 'Ontem'], ['yesterday', 'ontem'],
                ['+ more', '+ mais'], ['+more', '+ mais'],
                ['Sign up', 'Cadastrar-se'], ['Sign Up', 'Cadastrar-se'], ['sign up', 'cadastrar-se'],
                ['Login', 'Entrar'], ['login', 'entrar'], ['Log in', 'Entrar'],
                ['Account', 'Conta'], ['account', 'conta'],
                ['TV series', 'Séries de TV'], ['TV Series', 'Séries de TV'], ['tv series', 'séries de TV'],
                ['Movies', 'Filmes'], ['movies', 'filmes'],
                ['Calendar', 'Calendário'], ['calendar', 'calendário'],
                ['Tentative dates', 'Datas Provisórias'], ['Tentative Dates', 'Datas Provisórias'],
                ['tentative dates', 'datas provisórias'], ['tentaive dates', 'datas provisórias'], ['Tentative', 'Provisórias'],
                ['All products', 'Todos os Jogos'],
                ['All Products', 'Todos os Jogos'],
                ['PC (Early Access)', 'PC (Acesso Antecipado)'],
                ['Early Access', 'Acesso Antecipado'],
                ['Release Date', 'Data de Lançamento'],
                ['Release Dates', 'Datas de Lançamento'],
                ['Coming Soon', 'Em Breve'],
                ['TBA', 'A Anunciar'],
                ['To Be Announced', 'A Ser Anunciado'],
                ['Released', 'Lançado'],
                ['Upcoming', 'Próximos Lançamentos'],
                ['Popularity', 'Popularidade'],
                ['Sort by', 'Ordenar por'],
                ['Platforms', 'Plataformas'],
                ['Genres', 'Gêneros'],
                ['Search', 'Buscar'],
                ['Filter', 'Filtrar'],
                ['Developer', 'Desenvolvedora'],
                ['Publisher', 'Publicadora'],
                ['Overview', 'Visão Geral'],
                ['Details', 'Detalhes'],
                ['Summary', 'Resumo'],
                ['Single-player', 'Um Jogador'],
                ['Multi-player', 'Multijogador'],
                ['Multiplayer', 'Multijogador'],
                ['Co-op', 'Cooperativo'],
                ['Action', 'Ação'],
                ['Adventure', 'Aventura'],
                ['Role-playing', 'RPG'],
                ['Strategy', 'Estratégia'],
                ['Simulation', 'Simulação'],
                ['Sports', 'Esportes'],
                ['Racing', 'Corrida'],
                ['Puzzle', 'Quebra-cabeça'],
                ['Shooter', 'Tiro'],
                ['Horror', 'Terror'],
                ['Survival', 'Sobrevivência'],
                ['Open World', 'Mundo Aberto'],
                ['Indie', 'Independente'],
                ['First Quarter', '1º Trimestre'],
                ['Second Quarter', '2º Trimestre'],
                ['Third Quarter', '3º Trimestre'],
                ['Fourth Quarter', '4º Trimestre'],
                ['Q1', '1º Trimestre'],
                ['Q2', '2º Trimestre'],
                ['Q3', '3º Trimestre'],
                ['Q4', '4º Trimestre'],
                ['January', 'Janeiro'], ['February', 'Fevereiro'], ['March', 'Março'], ['April', 'Abril'],
                ['May', 'Maio'], ['June', 'Junho'], ['July', 'Julho'], ['August', 'Agosto'],
                ['September', 'Setembro'], ['October', 'Outubro'], ['November', 'Novembro'], ['December', 'Dezembro'],
                ['Jan ', 'Jan '], ['Feb ', 'Fev '], ['Mar ', 'Mar '], ['Apr ', 'Abr '], ['May ', 'Mai '], ['Jun ', 'Jun '],
                ['Jul ', 'Jul '], ['Aug ', 'Ago '], ['Sep ', 'Set '], ['Oct ', 'Out '], ['Nov ', 'Nov '], ['Dec ', 'Dez ']
              ];

              function translateNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                  let text = node.nodeValue;
                  if (!text || !text.trim()) return;
                  let modified = text;

                  const monthMap = {
                    jan: 'Janeiro', feb: 'Fevereiro', mar: 'Março', apr: 'Abril',
                    may: 'Maio', jun: 'Junho', jul: 'Julho', aug: 'Agosto', ago: 'Agosto',
                    sep: 'Setembro', set: 'Setembro', oct: 'Outubro', out: 'Outubro',
                    nov: 'Novembro', dec: 'Dezembro', dez: 'Dezembro',
                    january: 'Janeiro', february: 'Fevereiro', march: 'Março', april: 'Abril',
                    june: 'Junho', july: 'Julho', august: 'Agosto', september: 'Setembro',
                    october: 'Outubro', november: 'Novembro', december: 'Dezembro'
                  };

                  // 0) "Last week Aug 3 - 9" -> "Semana passada 3 - 9 de Agosto"
                  modified = modified.replace(/\bLast\s+week\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)\s*-\s*(\d+)\b/gi, function(match, mStr, dStart, dEnd) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    return 'Semana passada ' + dStart + ' - ' + dEnd + ' de ' + mName;
                  });
                  modified = modified.replace(/\bThis\s+week\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)\s*-\s*(\d+)\b/gi, function(match, mStr, dStart, dEnd) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    return 'Esta semana ' + dStart + ' - ' + dEnd + ' de ' + mName;
                  });
                  modified = modified.replace(/\bNext\s+week\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)\s*-\s*(\d+)\b/gi, function(match, mStr, dStart, dEnd) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    return 'Próxima semana ' + dStart + ' - ' + dEnd + ' de ' + mName;
                  });

                  // 1) "Aug 6th 3 days ago" / "Ago 6th 3 days ago" -> "6 Agosto 3 dias atrás"
                  modified = modified.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)(st|nd|rd|th)\s+(\d+)\s+days?\s+ago\b/gi, function(match, mStr, day, ord, num) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    var dTxt = parseInt(num, 10) === 1 ? 'dia' : 'dias';
                    return day + ' ' + mName + ' ' + num + ' ' + dTxt + ' atrás';
                  });

                  // 2) "Aug 6th in 3 days" -> "6 Agosto em 3 dias"
                  modified = modified.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)(st|nd|rd|th)\s+in\s+(\d+)\s+days?\b/gi, function(match, mStr, day, ord, num) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    var dTxt = parseInt(num, 10) === 1 ? 'dia' : 'dias';
                    return day + ' ' + mName + ' em ' + num + ' ' + dTxt;
                  });

                  // 3) "Aug 6th" / "Ago 6th" -> "6 Agosto"
                  modified = modified.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Ago|Sep|Set|Oct|Out|Nov|Dec|Dez|January|February|March|April|June|July|August|September|October|November|December)\s+(\d+)(st|nd|rd|th)\b/gi, function(match, mStr, day) {
                    var mName = monthMap[mStr.toLowerCase()] || mStr;
                    return day + ' ' + mName;
                  });

                  // 4) Standalone relative dates
                  modified = modified.replace(/\b(\d+)\s+months?\s+ago\b/gi, function(match, num) {
                    var mTxt = parseInt(num, 10) === 1 ? 'mês' : 'meses';
                    return num + ' ' + mTxt + ' atrás';
                  });
                  modified = modified.replace(/\bmonths\s+ago\b/gi, 'meses atrás');
                  modified = modified.replace(/\bmonth\s+ago\b/gi, 'mês atrás');
                  modified = modified.replace(/\b(\d+)\s+days\s+ago\b/gi, '$1 dias atrás');
                  modified = modified.replace(/\b(\d+)\s+day\s+ago\b/gi, '$1 dia atrás');
                  modified = modified.replace(/\bin (\d+) days\b/gi, 'em $1 dias');
                  modified = modified.replace(/\bin (\d+) day\b/gi, 'em $1 dia');
                  modified = modified.replace(/\bin (\d+) months\b/gi, 'em $1 meses');
                  modified = modified.replace(/\bin (\d+) month\b/gi, 'em $1 mês');

                  for (const [en, pt] of dict) {
                    if (modified.includes(en)) {
                      modified = modified.split(en).join(pt);
                    }
                  }
                  if (modified !== text) {
                    node.nodeValue = modified;
                  }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                  if (['SCRIPT', 'STYLE', 'IFRAME'].includes(node.tagName)) return;
                  for (const child of node.childNodes) {
                    translateNode(child);
                  }
                }
              }

              const applyTranslation = () => translateNode(document.body);
              applyTranslation();

              const observer = new MutationObserver(() => applyTranslation());
              if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
              }
            })();
          `)
          .catch(() => {})
      }

      webviewEl
        .executeJavaScript(`
          (function injectGhostLanguageFlags() {
            if (document.getElementById('ghost-flag-pill-selector')) return;

            const wrap = document.createElement('div');
            wrap.id = 'ghost-flag-pill-selector';
            wrap.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 24px;margin-top:auto;margin-bottom:12px;background:transparent;border:none;box-shadow:none;z-index:999999;';

            const btnPt = document.createElement('button');
            btnPt.type = 'button';
            btnPt.title = 'Português (Brasil)';
            btnPt.style.cssText = 'background:transparent;border:none;outline:none;box-shadow:none;padding:0;margin:0;cursor:pointer;line-height:0;display:inline-block;';
            const imgPt = document.createElement('img');
            imgPt.src = "${flagBrData}";
            imgPt.alt = 'Brasil';
            imgPt.style.cssText = 'width:32px;height:21px;object-fit:cover;border-radius:2px;display:block;border:none;outline:none;box-shadow:none;transition:transform 0.2s ease;image-rendering:-webkit-optimize-contrast;image-rendering:high-quality;';
            btnPt.appendChild(imgPt);
            btnPt.onmouseover = function() { imgPt.style.transform = 'scale(1.12)'; };
            btnPt.onmouseout = function() { imgPt.style.transform = 'scale(1.0)'; };
            btnPt.onclick = function() {
              localStorage.setItem("ghost_releases_lang", "pt-br");
              console.log("GHOST_LANG_CHANGE:pt-br");
              window.location.reload();
            };

            const btnEn = document.createElement('button');
            btnEn.type = 'button';
            btnEn.title = 'English (United States)';
            btnEn.style.cssText = 'background:transparent;border:none;outline:none;box-shadow:none;padding:0;margin:0;cursor:pointer;line-height:0;display:inline-block;';
            const imgEn = document.createElement('img');
            imgEn.src = "${flagUsData}";
            imgEn.alt = 'United States';
            imgEn.style.cssText = 'width:32px;height:21px;object-fit:cover;border-radius:2px;display:block;border:none;outline:none;box-shadow:none;transition:transform 0.2s ease;image-rendering:-webkit-optimize-contrast;image-rendering:high-quality;';
            btnEn.appendChild(imgEn);
            btnEn.onmouseover = function() { imgEn.style.transform = 'scale(1.12)'; };
            btnEn.onmouseout = function() { imgEn.style.transform = 'scale(1.0)'; };
            btnEn.onclick = function() {
              localStorage.setItem("ghost_releases_lang", "en");
              console.log("GHOST_LANG_CHANGE:en");
              window.location.reload();
            };

            wrap.appendChild(btnPt);
            wrap.appendChild(btnEn);

            const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="Sidebar"]');
            if (sidebar) {
              sidebar.appendChild(wrap);
            }
          })();

          (function applyCleanLayoutTheme() {
            function updateTheme() {
              const isLight = document.body.className.includes('LightMode');
              const sidebarBg = isLight ? '#e8ecf0' : '#0d0f14';
              const mainBg = isLight ? '#f0f2f5' : '#141721';
              const borderSide = isLight ? '1px solid #d0d7de' : '1px solid rgba(255, 255, 255, 0.08)';

              // 1. Left Sidebar Expansion & Theme Background
              const leftElements = document.querySelectorAll('aside, nav, div[class*="sidebar"], div[class*="Sidebar"], div[class*="menu"], div[class*="Menu"], div[class*="left-nav"], div[class*="LeftNav"]');
              leftElements.forEach(el => {
                const className = (el.className || '').toString();
                if (!el.closest('main') && !el.closest('.RWP-Calendar-Header') && !el.closest('header') && !className.includes('AtMenu') && !className.includes('atmenu')) {
                  el.style.setProperty('min-width', '280px', 'important');
                  el.style.setProperty('width', '280px', 'important');
                  el.style.setProperty('background-color', sidebarBg, 'important');
                  el.style.setProperty('background', sidebarBg, 'important');
                  el.style.setProperty('border-right', borderSide, 'important');
                }
              });

              // 1a. Reset AtMenu in header to prevent black rectangle
              const atMenus = document.querySelectorAll('.RWP-Calendar-AtMenu, [class*="AtMenu"], [class*="HeaderPointDropdownControl"]');
              atMenus.forEach(el => {
                el.style.removeProperty('min-width');
                el.style.removeProperty('width');
                el.style.setProperty('background-color', 'transparent', 'important');
                el.style.setProperty('background', 'transparent', 'important');
              });

              // 1b. Left Sidebar Footer / Theme Controls
              const leftFooters = document.querySelectorAll('.RWPC-Nav-ThemeMode, [class*="RWPC-Nav-ThemeMode"], [class*="ThemeMode"], [class*="themeMode"], [class*="mode-switch"], [class*="modeSwitch"], [class*="theme-toggle"], [class*="themeToggle"], footer, [class*="footer"], [class*="bottom"]');
              leftFooters.forEach(el => {
                if (!el.closest('main')) {
                  el.style.setProperty('background-color', sidebarBg, 'important');
                  el.style.setProperty('background', sidebarBg, 'important');
                  el.style.setProperty('border', 'none', 'important');
                  el.style.setProperty('border-top', borderSide, 'important');
                  el.style.setProperty('box-shadow', 'none', 'important');
                }
              });

              // 2. Right Sidebar & all its filter boxes/checkboxes
              const rightSidebars = document.querySelectorAll('aside:last-of-type, [class*="right-nav"], [class*="RightNav"], [class*="Calendar-Filter"], [class*="calendar-filter"]');
              rightSidebars.forEach(rightSidebar => {
                if (rightSidebar && !rightSidebar.closest('.RWP-Calendar-Header') && !rightSidebar.closest('header')) {
                  rightSidebar.style.setProperty('background-color', sidebarBg, 'important');
                  rightSidebar.style.setProperty('background', sidebarBg, 'important');
                  rightSidebar.style.setProperty('border-left', borderSide, 'important');
                  rightSidebar.querySelectorAll('div, section, ul, li').forEach(el => {
                    const className = (el.className || '').toString();
                    if (!className.includes('btn') && !className.includes('button') && !className.includes('checkbox') && !el.closest('.RWP-Calendar-Header')) {
                      el.style.setProperty('background-color', sidebarBg, 'important');
                      el.style.setProperty('background', sidebarBg, 'important');
                    }
                  });
                }
              });

              // 3. Central Main Content Area
              const mainCentral = document.querySelectorAll('main, [class*="main-content"], [class*="MainContent"]');
              mainCentral.forEach(el => {
                el.style.setProperty('background-color', mainBg, 'important');
                el.style.setProperty('background', mainBg, 'important');
              });

              // 3b. Date Group Headers -> Native Original (Transparent Background)
              const groupHeaders = document.querySelectorAll('.RWP-Calendar-GroupHeader, [class*="RWP-Calendar-GroupHeader"], [class*="GroupHeader"]');
              groupHeaders.forEach(el => {
                el.style.setProperty('background-color', 'transparent', 'important');
                el.style.setProperty('background', 'transparent', 'important');
                el.querySelectorAll('*').forEach(child => {
                  child.style.setProperty('background-color', 'transparent', 'important');
                  child.style.setProperty('background', 'transparent', 'important');
                });
              });
            }
            updateTheme();

            const observer = new MutationObserver(() => updateTheme());
            if (document.body) {
              observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            }

            document.addEventListener('click', (e) => {
              const target = e.target && e.target.closest ? e.target.closest('button[data-theme-mode], .RWPC-Nav-ThemeMode-Button, .RWPC-Nav-ThemeMode-Item') : null;
              if (target) {
                setTimeout(updateTheme, 50);
                setTimeout(updateTheme, 300);
              }
            }, true);
          })();
        `)
        .catch(() => {})
    }

    const handleConsoleMessage = (e: any) => {
      if (e.message && typeof e.message === 'string' && e.message.startsWith('GHOST_LANG_CHANGE:')) {
        const newLang = e.message.split(':')[1] as 'pt-br' | 'en'
        localStorage.setItem('ghost_releases_lang', newLang)
        setLang(newLang)
      }
    }

    webviewEl.addEventListener('did-finish-load', handleLoad)
    webviewEl.addEventListener('console-message', handleConsoleMessage)

    return () => {
      webviewEl.removeEventListener('did-finish-load', handleLoad)
      webviewEl.removeEventListener('console-message', handleConsoleMessage)
    }
  }, [lang])

  return (
    <div className="Releases">
      <webview
        ref={webviewRef}
        className="Releases__webview"
        partition="persist:releases"
        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        src={releasesUrl}
        allowpopups={'true' as unknown as boolean}
      />
    </div>
  )
}
