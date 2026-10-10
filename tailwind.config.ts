import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF9",
        surface: "#F5F5F4",
        "surface-raised": "#FFFFFF",
        border: "#E5E5E3",
        "border-subtle": "#EFEFEA",
        text: {
          primary: "#1C1C1A",
          muted: "#6B6B66",
          subtle: "#9C9C96",
        },
        accent: {
          DEFAULT: "#1F6F54",
          hover: "#185943",
          active: "#124332",
          tint: "#EBF5F1",
          subtle: "#F2F8F5",
        },
        status: {
          pass: "#16A34A",
          "pass-bg": "#ECFDF5",
          "pass-border": "#A7F3D0",
          warn: "#D97706",
          "warn-bg": "#FFFBEB",
          "warn-border": "#FDE68A",
          fail: "#DC2626",
          "fail-bg": "#FEF2F2",
          "fail-border": "#FECACA",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      borderRadius: {
        panel: "8px",
        btn: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
