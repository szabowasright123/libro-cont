/**
 * tema.ts — tema visual de la app: claro, oscuro o «como el sistema».
 *
 * Antes solo existía el modo automático (`prefers-color-scheme`), sin forma de elegir.
 * Ahora la preferencia es explícita y se recuerda entre sesiones.
 *
 * Local-first (Regla 3): la preferencia vive en `localStorage` del propio navegador; no
 * viaja a ninguna parte ni se guarda en la base del Libro (no es un dato contable, es una
 * preferencia de este equipo).
 *
 * El tema se materializa como la clase `dark` en `<html>`, que es lo que activa las
 * variantes `dark:` de Tailwind (`darkMode: 'class'`). El primer pintado lo resuelve el
 * script en línea de `index.html`, para que arrancar en oscuro no dé un destello blanco.
 */
import { useEffect, useState } from 'react'

/** Preferencia elegida por el alumno. `sistema` = seguir al sistema operativo. */
export type Tema = 'claro' | 'oscuro' | 'sistema'

/** Tema realmente pintado (`sistema` ya resuelto). */
export type TemaEfectivo = 'claro' | 'oscuro'

/** Clave de `localStorage`. La misma que lee el script en línea de `index.html`. */
export const CLAVE_TEMA = 'hesperides.tema'

/** Evento propio para que todas las piezas montadas (cabecera, Ajustes) se sincronicen. */
export const EVENTO_TEMA = 'hesperides:tema'

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)'

/** Color de la barra del navegador en cada tema (coincide con el lienzo de `index.css`). */
const COLOR_BARRA: Record<TemaEfectivo, string> = { claro: '#fafaf9', oscuro: '#020617' }

/** Valor CSS de `color-scheme`: la propiedad es del navegador y va en inglés. */
const ESQUEMA_CSS: Record<TemaEfectivo, string> = { claro: 'light', oscuro: 'dark' }

/** `matchMedia` del modo oscuro, o `null` donde no exista (jsdom en los tests). */
function consultaSistema(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_OSCURO) : null
  } catch {
    return null
  }
}

/** ¿El sistema operativo pide oscuro? Sin `matchMedia` se asume claro. */
export function sistemaEnOscuro(): boolean {
  return consultaSistema()?.matches ?? false
}

/** Preferencia guardada. Por defecto `sistema` (comportamiento histórico de la app). */
export function leerTema(): Tema {
  try {
    const v = localStorage.getItem(CLAVE_TEMA)
    return v === 'claro' || v === 'oscuro' ? v : 'sistema'
  } catch {
    // localStorage puede fallar en navegación privada: no es crítico.
    return 'sistema'
  }
}

/** Resuelve `sistema` al tema que toca pintar ahora mismo. */
export function temaEfectivo(tema: Tema): TemaEfectivo {
  if (tema === 'claro' || tema === 'oscuro') return tema
  return sistemaEnOscuro() ? 'oscuro' : 'claro'
}

/** Pinta el tema en el documento: clase `dark`, `color-scheme` y color de barra. */
export function aplicarTema(tema: Tema): TemaEfectivo {
  const efectivo = temaEfectivo(tema)
  const html = document.documentElement
  html.classList.toggle('dark', efectivo === 'oscuro')
  // `color-scheme` es lo que tiñe los widgets nativos (scrollbars, selects, date pickers).
  html.style.colorScheme = ESQUEMA_CSS[efectivo]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[efectivo])
  return efectivo
}

/** Guarda la preferencia, la aplica y avisa al resto de la interfaz. */
export function guardarTema(tema: Tema): void {
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, tema)
  } catch {
    /* Sin persistencia (modo privado): el tema vale para esta sesión. */
  }
  aplicarTema(tema)
  window.dispatchEvent(new Event(EVENTO_TEMA))
}

/**
 * Hook del tema: preferencia elegida, tema efectivo y el modo de cambiarlo.
 *
 * Se resincroniza con tres señales: el cambio hecho desde otra pieza de la app
 * (`EVENTO_TEMA`), el cambio hecho en otra pestaña (`storage`) y el cambio de preferencia
 * del sistema operativo (`matchMedia`), que solo importa cuando la preferencia es `sistema`.
 */
export function useTema(): {
  tema: Tema
  efectivo: TemaEfectivo
  setTema: (tema: Tema) => void
} {
  const [tema, setTemaEstado] = useState<Tema>(leerTema)
  const [efectivo, setEfectivo] = useState<TemaEfectivo>(() => temaEfectivo(leerTema()))

  useEffect(() => {
    const sincronizar = () => {
      const t = leerTema()
      setTemaEstado(t)
      setEfectivo(aplicarTema(t))
    }
    sincronizar()

    const mq = consultaSistema()
    window.addEventListener(EVENTO_TEMA, sincronizar)
    window.addEventListener('storage', sincronizar)
    mq?.addEventListener('change', sincronizar)
    return () => {
      window.removeEventListener(EVENTO_TEMA, sincronizar)
      window.removeEventListener('storage', sincronizar)
      mq?.removeEventListener('change', sincronizar)
    }
  }, [])

  return { tema, efectivo, setTema: guardarTema }
}
