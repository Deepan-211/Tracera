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
        desk: "#F2F4F7",
        paper: "#FFFFFF",
        ink: "#111827",
        rule: "#E5E7EB",
        stamp: "#EF4444",
        fact: "#10B981",
        observation: "#F59E0B",
        inference: "#6366F1",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        'glass': '0 20px 40px -15px rgba(0, 0, 0, 0.05)',
        'bento': '0 2px 10px rgba(0, 0, 0, 0.03), 0 10px 30px rgba(0, 0, 0, 0.04)',
        'dark-card': '0 20px 35px -10px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
