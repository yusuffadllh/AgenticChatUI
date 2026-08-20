import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        satoshi: ["Satoshi", "sans-serif"],
        "space-grotesk": ["Space Grotesk", "sans-serif"],
      },
      colors: {
        "neon-cyan": "#00F5FF",
        "void-black": "#0A0A0A",
        "dark-slate": "#1E1E2E",
      },
    },
  },
  plugins: [],
};

export default config;