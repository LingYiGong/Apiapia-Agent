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
        /**
         * Apple HIG 四层表面。取代全站 40+ 处
         * `dark:bg-[#1c1c1e]` / `[#2c2c2e]` / `[#121214]` 硬编码。
         * 见 globals.css 中 --surface-1..4 的层级说明。
         */
        surface: {
          "1": "hsl(var(--surface-1))",
          "2": "hsl(var(--surface-2))",
          "3": "hsl(var(--surface-3))",
          "4": "hsl(var(--surface-4))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      /**
       * 字体栈全部 var() 引用 globals.css 的 --font-sans / --font-mono。
       * 此前这里、globals.css 的 :root 变量、以及 body 上各抄了一份
       * 字面量，而 --font-sans / --font-sans-sc / --font-mono 三个变量
       * 从未被 var() 使用过。
       */
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
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
        // Standard Tailwind scales calibrated to Apple typography.
        // Apple HIG 的 pt 值以任意值形式写在用点（text-[13px] 等），
        // 这里只补两个 Tailwind 刻度里缺、且使用频率很高的档位。
        "2xs": ["11px", { lineHeight: "13px", letterSpacing: "0.07px" }],
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
