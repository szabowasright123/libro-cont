/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // El tema es una ELECCIÓN del alumno, no solo la preferencia del sistema: las variantes
  // `dark:` se activan con la clase `dark` en <html>, que gobierna `src/ui/tema.ts`.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semáforo del cuadre (DOMINIO §4): verde OK, ámbar REVISAR, rojo ERROR.
        semaforo: {
          ok: '#15803d',
          revisar: '#b45309',
          error: '#b91c1c',
        },
        // Identidad visual (P9.1): naranja bitcoin como ACENTO, nunca como fondo masivo.
        // La base neutra usa `stone` de Tailwind (gris cálido, ya disponible sin tokens).
        brand: {
          50: '#fdf4e8',
          100: '#fbe8cd',
          200: '#f6d19e',
          500: '#e8820c', // marcas, acentos, serie BTC
          600: '#b45309', // texto interactivo y botón sólido (4,6:1 sobre blanco)
          700: '#92400e',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
