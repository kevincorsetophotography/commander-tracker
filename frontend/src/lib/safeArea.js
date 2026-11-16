// Web app salvata sulla Home di iPhone (standalone, status bar "black-translucent"):
// la pagina parte da y=0, SOTTO l'ora/notch/Dynamic Island, e la distanza la dà
// env(safe-area-inset-top). Su alcune versioni di iOS quel valore arriva a 0
// (all'avvio da Home, finché non si ruota il telefono) e l'header finisce tagliato.
//
// Qui si calcola un minimo di riserva, usato in CSS come
//   --sat: max(env(safe-area-inset-top), var(--sat-min))
// SOLO se: iOS + standalone + verticale + la pagina occupa davvero tutto lo schermo
// (cioè il contenuto sta sotto la status bar). Altrove --sat-min resta 0px e vale
// solo env(), come prima.

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isStandalone = () =>
  navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches

// Altezza della status bar: 20px senza notch; 47-62px con notch / Dynamic Island.
// 50px copre i modelli con notch senza tagliare (il valore vero di env vince se maggiore).
export function statusBarFallback({ ios, standalone, portrait, innerHeight, screenH }) {
  if (!ios || !standalone || !portrait) return 0
  if (innerHeight < screenH - 1) return 0 // status bar opaca: il contenuto parte già sotto
  return screenH >= 812 ? 50 : 20
}

// Da iOS 26 la web app da Home sfuma (blur) anche una fascia SOTTO la status bar/Island:
// un margine in più tiene logo, campanella e avatar dell'header fuori dalla sfumatura.
export const IOS_APP_TOP_GAP = 16
export function headerTopGap({ ios, standalone }) {
  return ios && standalone ? IOS_APP_TOP_GAP : 0
}

export function installSafeAreaFallback() {
  if (typeof window === 'undefined') return
  const apply = () => {
    const portrait = window.matchMedia?.('(orientation: portrait)').matches ?? true
    const px = statusBarFallback({
      ios: isIOS(),
      standalone: isStandalone(),
      portrait,
      innerHeight: window.innerHeight,
      screenH: Math.max(window.screen.width, window.screen.height),
    })
    document.documentElement.style.setProperty('--sat-min', `${px}px`)
    document.documentElement.style.setProperty('--sat-gap', `${headerTopGap({ ios: isIOS(), standalone: isStandalone() })}px`)
  }
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
}
