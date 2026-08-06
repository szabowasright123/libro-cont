import { AppShell } from '../ui/shell/AppShell'
import { ActualizacionPWA } from '../pwa/ActualizacionPWA'

/**
 * App — layout raíz. Aloja el enrutado (Inicio, Diario, Archivo, Trazabilidad,
 * Fiscal, Ubicaciones, Parámetros, Ajustes, Acerca de) a través del AppShell, y
 * el aviso de actualización de la PWA.
 */
export function App() {
  return (
    <>
      <AppShell />
      <ActualizacionPWA />
    </>
  )
}
