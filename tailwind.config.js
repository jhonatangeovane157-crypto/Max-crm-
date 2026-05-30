/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        foreground: "#ffffff",

        primary: {
          DEFAULT: "#D4AF37",
          foreground: "#000000",
        },

        gold: {
          50: "#FFF9E6",
          100: "#FCEFC7",
          200: "#F9DF8B",
          300: "#F4C842",
          400: "#E0B94B",
          500: "#D4AF37",
          600: "#B8941F",
          700: "#8A6E12",
          800: "#5E4B0C",
          900: "#3A2D07",
        },

        card: "#0B0B0B",
        border: "#1A1A1A",
        muted: "#999999",
      },

      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },

      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },

      boxShadow: {
        glow: "0 0 40px rgba(212,175,55,0.15)",
      },
    },
  },
  plugins: [],
}
