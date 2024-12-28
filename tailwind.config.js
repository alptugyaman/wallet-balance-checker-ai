/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'app-dark': '#121212',
        'app-dark-secondary': '#1E1E1E',
      }
    },
  },
  plugins: [],
}

