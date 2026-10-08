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
    // 原先这里有 container 配置（center + 2rem padding + 2xl:1400px）。
    // 全站 0 处使用 `container` 类 —— 布局宽度一律由各视图的
    // `max-w-*` + `mx-auto` 自己控制，因此整段删除。
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
          // 原先这里还有一整套 50..900 的 indigo 阶梯（shadcn 样板）。
          // 全站 0 处引用 —— 实际用的是 Tailwind 内置的 `indigo-*` 原始色板
          // （如 text-indigo-600），所以这 10 个自定义档位既没被用到，
          // 又和内层色板同名易混，整段删除。
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
      /**
       * 字号刻度 —— 逐档对齐 Apple HIG（iOS Dynamic Type, Large 档）。
       *
       * 每档的 lineHeight 直接取 Apple 对应 text style 的 leading；
       * letterSpacing 取 Apple 官方 SF Pro tracking 表中该字号的值
       * （单位 1/1000 em，换算成 px）。表的关键区段：
       *   10pt +12‰ · 11pt +6‰ · 12pt 0 · 13pt -6‰ · 14pt -11‰
       *   15pt -16‰ · 16pt -20‰ · 17pt -26‰ · 20pt -23‰
       *   23pt -4‰ · 24pt +3‰ · 28pt +14‰ · 34pt +12‰ · 80pt 0
       *
       * 注意 17→28pt 之间 tracking 会**穿过 0 变正**：这是 SF Pro 从
       * Text 光学尺寸过渡到 Display 光学尺寸的结果（WWDC20 "The details
       * of UI typography"）。此前 `2xl`(24px) 写成 -0.5px，符号是反的。
       *
       * 全站不再使用 `text-[Npx]` 任意值 —— 任意值不带 tracking，会绕开
       * 这张表退回浏览器默认字距（这正是此前 body 上挂一个常量
       * letter-spacing 的根因）。下限为 11px = Apple iOS 最小字号。
       */
      fontSize: {
        "2xs": ["11px", { lineHeight: "13px", letterSpacing: "0.06px" }], // Caption 2
        xs: ["12px", { lineHeight: "16px", letterSpacing: "0px" }], //      Caption 1
        footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }], // Footnote
        sm: ["14px", { lineHeight: "20px", letterSpacing: "-0.15px" }],
        subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.23px" }], // Subhead
        base: ["16px", { lineHeight: "21px", letterSpacing: "-0.31px" }], //  Callout
        body: ["17px", { lineHeight: "22px", letterSpacing: "-0.43px" }], //    Body（iOS 正文标准）
        lg: ["18px", { lineHeight: "24px", letterSpacing: "-0.44px" }],
        xl: ["20px", { lineHeight: "25px", letterSpacing: "-0.45px" }], //      Title 3
        "2xl": ["22px", { lineHeight: "28px", letterSpacing: "-0.26px" }], //   Title 2
        "3xl": ["28px", { lineHeight: "34px", letterSpacing: "0.38px" }], //    Title 1
        "4xl": ["34px", { lineHeight: "41px", letterSpacing: "0.4px" }], //     Large Title
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        // accordion-down / accordion-up 此前在此定义，但 `@tailwindcss/accordion`
        // 并未安装，全站 0 处引用 `animate-accordion-*` —— 已删。
        shimmer: "shimmer 1.5s infinite linear",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require("tailwindcss-animate")],
};
export default config;
