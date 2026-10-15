import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        desk: "var(--desk)",
        paper: "var(--paper)",
        ink: "var(--ink)",
        rule: "var(--rule)",
        stamp: "var(--stamp)",
        fact: "#2F6B3A",
        observation: "#9A6A12",
        inference: "#3E5560",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "IBM Plex Sans", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0px",
        none: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
        full: "0px",
      },
      boxShadow: {
        offset: "1px 1px 0px 0px var(--rule)",
        "offset-dark": "1px 1px 0px 0px var(--ink)",
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
