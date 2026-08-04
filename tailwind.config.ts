import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf9ec",
          100: "#faf0cb",
          200: "#f3dd93",
          300: "#ebc85e",
          400: "#e0b23a",
          500: "#C9A227",
          600: "#a87f1e",
          700: "#835f1b",
          800: "#6c4d1c",
          900: "#5c421c",
        },
        navy: {
          DEFAULT: "#111921",
          soft: "#18202a",
        },
        masdora: {
          orange: "#F26122",
          olive: "#6B8042",
          yellow: "#FDE585",
          gray: "#D8D6CF",
          alert: "#D9432A",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-dm-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.45s cubic-bezier(0.4,0,0.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
