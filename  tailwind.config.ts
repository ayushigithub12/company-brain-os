import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#EEEDFE",
          100: "#D4D2FD",
          200: "#ADA9FB",
          300: "#8680F8",
          400: "#6E67F5",
          500: "#534AB7",
          600: "#3C3489",
          700: "#2D2667",
          800: "#1E1945",
          900: "#0F0D22",
        },
        surface: {
          DEFAULT: "#FAFAF9",
          secondary: "#F1EFE8",
        },
      },
    },
  },
  plugins: [],
};

export default config;