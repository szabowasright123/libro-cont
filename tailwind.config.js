/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semáforo del cuadre (DOMINIO §4): verde OK, ámbar REVISAR, rojo ERROR.
        semaforo: {
          ok: '#15803d',
          revisar: '#b45309',
          error: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
