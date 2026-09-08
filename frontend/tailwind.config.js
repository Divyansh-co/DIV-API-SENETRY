/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: 'rgba(11, 10, 31, 0.55)',
          primary: 'rgba(11, 10, 31, 0.55)',
          surface: 'rgba(20, 24, 46, 0.52)',
          char: 'rgba(18, 22, 42, 0.55)',
          card: 'rgba(15, 17, 34, 0.55)',
          border: 'rgba(130, 190, 255, 0.2)',
          hover: 'rgba(35, 42, 75, 0.6)',
        },
        dark: {
          bg: "rgba(11, 10, 31, 0.55)",
          surface: "rgba(20, 24, 46, 0.52)",
          card: "rgba(15, 17, 34, 0.55)",
          border: "rgba(130, 190, 255, 0.2)",
          hover: "rgba(35, 42, 75, 0.6)",
        },
        bronze: {
          DEFAULT: '#B08D57',
          primary: '#B08D57',
          deep: '#7A6138',
          highlight: '#E8CFA3',
          hairline: 'rgba(176, 141, 87, 0.18)',
        },
        bone: '#EDEBE6',
        warmash: '#A8A6A1',
        champagne: '#E8CFA3',
        cobalt: {
          DEFAULT: '#B08D57',
          light: '#E8CFA3',
          dark: '#7A6138',
        },
        brand: {
          DEFAULT: '#B08D57',
          50: '#FDFBF7',
          100: '#F7F3EB',
          200: '#EDE4D1',
          300: '#E0D0B3',
          400: '#CEB890',
          500: '#B08D57',
          600: '#947342',
          700: '#7A6138',
          800: '#5F4B2C',
          900: '#43341F',
        },
        status: {
          fail: "#F87171",
          warning: "#FBBF24",
          minor: "#FCD34D",
          pass: "#4ADE80",
          info: "#B08D57",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }
    },
  },
  plugins: [],
}
