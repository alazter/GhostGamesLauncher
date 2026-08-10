import { useState, useRef, useEffect } from 'react'
import flagsB64 from 'frontend/assets/flags_b64.json'
import './index.css'

const flagBrData = 'data:image/png;base64,' + flagsB64.br
const flagUsData = 'data:image/png;base64,' + flagsB64.us

export default function Releases() {
  const [lang, setLang] = useState<'pt-br' | 'en'>(() => {
    return (localStorage.getItem('ghost_releases_lang') as 'pt-br' | 'en') || 'pt-br'
  })

  const webviewRef = useRef<Electron.WebviewTag>(null)
  const releasesUrl =
    'https://www.releases.com/calendar/products?f=t%3AGame&f=v%3APC&f=v%3APC%20%28Early%20Access%29'

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
          body {
            background-color: #121216 !important;
            color: #e0e0e0 !important;
          }
          aside,
          nav,
          div[class*="sidebar"],
          div[class*="Sidebar"],
          div[class*="menu"],
          div[class*="Menu"],
          div[class*="left-nav"],
          div[class*="LeftNav"] {
            min-width: 270px !important;
            width: 270px !important;
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
        src={releasesUrl}
        allowpopups={'true' as unknown as boolean}
      />
    </div>
  )
}
