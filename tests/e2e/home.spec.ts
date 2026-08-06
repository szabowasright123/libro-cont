import { test, expect } from '@playwright/test'

// E2E de humo (P0): la home carga, muestra el nombre y confirma que la base local abre.
test('la página de inicio carga y abre la base de datos local', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Libro Hespérides' })).toBeVisible()
  // El estado de IndexedDB pasa de "abriendo…" a "abierta".
  await expect(page.getByText(/abierta ·/)).toBeVisible()
})
