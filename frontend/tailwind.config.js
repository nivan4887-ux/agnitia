/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EA580C',
          600: '#D95A1E',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        espresso: {
          50: '#F5F2F0',
          100: '#E6DFDB',
          200: '#CCBFB8',
          300: '#B09E94',
          400: '#8C776C',
          500: '#675247',
          600: '#4E3B32',
          700: '#382820',
          800: '#261A13',
          900: '#19110B',
          950: '#110B07',
        },
        warm: {
          50: '#FDFCF9',
          100: '#FAF8F5',
          200: '#F4F0E9',
          300: '#EBE5DA',
          400: '#DCD4C5',
          500: '#C5BBAA',
          600: '#9E9483',
          700: '#746B5C',
          800: '#4D463B',
          900: '#2D2820',
        },
        sand: {
          border: '#E7E2D9',
          borderDark: '#D5CEC2',
          bg: '#FAF8F5',
          card: '#FFFFFF',
        }
      },
    },
  },
  plugins: [],
}

