import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"SF Pro"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "-apple-system-monospaced",
          '"SF Mono"',
          "SFMono-Regular",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      // Tailwind v3 ships no `xs` / `2xs` shadow step (they arrived in v4), so every
      // `shadow-2xs` / `shadow-xs` / `drop-shadow-xs` in the codebase silently
      // emitted nothing. Both are re-declared here as a sub-`sm` tier:
      // `2xs` is the hairline used by the glass cards whose depth comes from
      // backdrop-blur + border, `xs` matches v3's `shadow-sm` value so chips,
      // logos and avatars sit at the same elevation as the shadcn primitives.
      boxShadow: {
        "2xs": "0 1px 1px 0 rgb(0 0 0 / 0.04)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      dropShadow: {
        xs: "0 1px 1px 0 rgb(0 0 0 / 0.06)",
      },
      fontSize: {
        // Apple HIG Dynamic Type Scale (pt / px)
        "apple-large-title": ["34px", { lineHeight: "41px", letterSpacing: "0.37px", fontWeight: "700" }],
        "apple-title-1": ["28px", { lineHeight: "34px", letterSpacing: "0.36px", fontWeight: "700" }],
        "apple-title-2": ["22px", { lineHeight: "28px", letterSpacing: "0.35px", fontWeight: "700" }],
        "apple-title-3": ["20px", { lineHeight: "25px", letterSpacing: "0.38px", fontWeight: "600" }],
        "apple-headline": ["17px", { lineHeight: "22px", letterSpacing: "-0.41px", fontWeight: "600" }],
        "apple-body": ["17px", { lineHeight: "22px", letterSpacing: "-0.41px" }],
        "apple-callout": ["16px", { lineHeight: "21px", letterSpacing: "-0.32px" }],
        "apple-subheadline": ["15px", { lineHeight: "20px", letterSpacing: "-0.24px" }],
        "apple-footnote": ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }],
        "apple-caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0px" }],
        "apple-caption-2": ["11px", { lineHeight: "13px", letterSpacing: "0.07px" }],
        // Standard Tailwind scales calibrated to Apple typography
        xs: ["12px", { lineHeight: "16px", letterSpacing: "0px" }],
        sm: ["14px", { lineHeight: "19px", letterSpacing: "-0.15px" }],
        base: ["16px", { lineHeight: "22px", letterSpacing: "-0.32px" }],
        lg: ["18px", { lineHeight: "23px", letterSpacing: "-0.41px" }],
        xl: ["20px", { lineHeight: "25px", letterSpacing: "-0.45px" }],
        "2xl": ["24px", { lineHeight: "29px", letterSpacing: "-0.5px" }],
        "3xl": ["28px", { lineHeight: "34px", letterSpacing: "0.36px" }],
        "4xl": ["34px", { lineHeight: "41px", letterSpacing: "0.37px" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
};
export default config;
