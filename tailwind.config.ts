import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
      },
    },
  },
  plugins: [],
};

export default config;
