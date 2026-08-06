import { HomePage } from '../ui/pages/HomePage'

/**
 * App — layout raíz provisional (P0). En fases siguientes alojará el enrutado
 * (Libro, Archivo, Cuadre, Fiscal). De momento solo la página de inicio.
 */
export function App() {
  return (
    <div className="min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <HomePage />
    </div>
  )
}
