import { useRef, useEffect } from 'react'
import './index.css'

export default function Releases() {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const clickedOnceRef = useRef(false)
  const releasesUrl = 'https://www.releases.com/l/pc'

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

      if (clickedOnceRef.current) return
      clickedOnceRef.current = true

      webviewEl
        .executeJavaScript(`
          (function autoClickAllProductsOnce() {
            if (window.__ghostClickDone) return;

            let attempts = 0;
            const maxAttempts = 12;

            function triggerClick(el) {
              try {
                if (typeof el.focus === 'function') el.focus();
                ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(eventType => {
                  const evt = new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                  });
                  el.dispatchEvent(evt);
                });
                if (typeof el.click === 'function') {
                  el.click();
                }
              } catch(e) {}
            }

            function findAndClick() {
              if (window.__ghostClickDone) return true;

              const elements = Array.from(
                document.querySelectorAll('a, button, li, div, span, [role="tab"], [role="button"]')
              );
              
              for (const el of elements) {
                const text = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (text === 'all products' || text === 'all-products' || text === 'todos os produtos') {
                  window.__ghostClickDone = true;
                  triggerClick(el);
                  return true;
                }
              }

              for (const el of elements) {
                const text = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (text.includes('all products')) {
                  window.__ghostClickDone = true;
                  triggerClick(el);
                  return true;
                }
              }

              return false;
            }

            const timer = setInterval(() => {
              attempts++;
              const done = findAndClick();
              if (done || attempts >= maxAttempts) {
                clearInterval(timer);
              }
            }, 300);
          })();
        `)
        .catch(() => {})
    }

    webviewEl.addEventListener('did-finish-load', handleLoad)

    return () => {
      webviewEl.removeEventListener('did-finish-load', handleLoad)
    }
  }, [])

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
