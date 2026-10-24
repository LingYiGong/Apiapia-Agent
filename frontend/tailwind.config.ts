import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/config/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    extend: {
      screens: {
        mdup: { raw: "(min-width: 768px) and (min-height: 600px)" },
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /** Apple HIG 四层表面 */
        surface: {
          "1": "hsl(var(--surface-1))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
          "4": "hsl(var(--surface-4))",
        },
        /** 代码块表面，统一引用 globals.css 的 --code-* 变量 */
        code: {
          DEFAULT: "hsl(var(--code-bg))",
          header: "hsl(var(--code-header))",
          foreground: "hsl(var(--code-fg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
        overlay: "22px",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        "2xs": "0 1px 1px 0 rgb(0 0 0 / 0.04)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      dropShadow: {
        xs: "0 1px 1px 0 rgb(0 0 0 / 0.06)",
      },
      fontSize: {
        "3xs": ["10px", { lineHeight: "14px", letterSpacing: "0.06px" }],
        "2xs": ["11px", { lineHeight: "15px", letterSpacing: "0.06px" }],
        xs: ["12px", { lineHeight: "17px", letterSpacing: "0px" }],
        footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }],
        sm: ["14px", { lineHeight: "20px", letterSpacing: "-0.15px" }],
        subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.23px" }],
        base: ["16px", { lineHeight: "21px", letterSpacing: "-0.31px" }],
        body: ["17px", { lineHeight: "22px", letterSpacing: "-0.43px" }],
        lg: ["18px", { lineHeight: "24px", letterSpacing: "-0.44px" }],
        xl: ["20px", { lineHeight: "25px", letterSpacing: "-0.45px" }],
        "2xl": ["22px", { lineHeight: "28px", letterSpacing: "-0.26px" }],
        "3xl": ["28px", { lineHeight: "34px", letterSpacing: "0.38px" }],
        "4xl": ["34px", { lineHeight: "41px", letterSpacing: "0.4px" }],
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
};
export default config;
