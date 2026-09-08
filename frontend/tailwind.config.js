/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jade: {
          DEFAULT: '#00E599',
          neon: '#00E599',
          glow: 'rgba(0, 229, 153, 0.45)',
          light: '#6EE7B7',
          deep: '#059669',
          dark: '#047857',
          forest: '#064E3B',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#064E3B',
          900: '#022C22',
          950: '#011A14',
        },
        obsidian: {
          DEFAULT: 'rgba(3, 14, 11, 0.72)',
          primary: 'rgba(3, 14, 11, 0.72)',
          surface: 'rgba(6, 24, 19, 0.65)',
          char: 'rgba(4, 18, 14, 0.7)',
          card: 'rgba(4, 20, 16, 0.68)',
          border: 'rgba(0, 229, 153, 0.22)',
          hover: 'rgba(0, 229, 153, 0.14)',
        },
        dark: {
          bg: "#020907",
          surface: "rgba(6, 24, 19, 0.65)",
          card: "rgba(4, 20, 16, 0.68)",
          border: "rgba(0, 229, 153, 0.22)",
          hover: "rgba(0, 229, 153, 0.14)",
        },
        bronze: {
          DEFAULT: '#00E599',
          primary: '#00E599',
          deep: '#059669',
          highlight: '#6EE7B7',
          hairline: 'rgba(0, 229, 153, 0.22)',
        },
        bone: '#ECFDF5',
        warmash: '#94A3B8',
        champagne: '#6EE7B7',
        cobalt: {
          DEFAULT: '#00E599',
          light: '#6EE7B7',
          dark: '#059669',
        },
        brand: {
          DEFAULT: '#00E599',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#064E3B',
          900: '#022C22',
        },
        status: {
          fail: "#F87171",
          warning: "#FBBF24",
          minor: "#FCD34D",
          pass: "#00E599",
          info: "#34D399",
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
