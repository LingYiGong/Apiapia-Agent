/**
 * 多语言基础设施的类型层。
 *
 * 本项目此前没有任何 i18n 设施：所有界面文案都是各组件里硬编码的中文，散落在
 * 88 个 ts/tsx 文件里。新增语言时无处可加 —— 只能全局搜索替换，既漏得掉也改不动。
 * 这里把「有哪些语言」「文案长什么样」「怎么查一条文案」三件事集中到一处，
 * 后续新增语言只改 messages/ 下的文件，组件代码不动。
 *
 * 三条设计约束：
 *
 * 1. **不引入第三方库。** 本项目一贯的取舍是「依赖能少就少」—— DuckDuckGo 检索是
 *    自己用 httpx 抓的，Anthropic / Gemini 客户端是手写的。next-intl 这类方案要改
 *    next.config、加 middleware、重排全部路由，而本项目同时支持
 *    `output: "export"` 的纯静态导出（Cloudflare Pages），路由改造的验证成本很高。
 *
 * 2. **不带 URL 前缀。** 语言存在 localStorage，路由保持 /chat /memory /settings
 *    原样。代价是不能分享某个语言的链接，收益是现有深链、书签、登录跳转、
 *    移动端 ?tab= 页签全部不受影响，静态导出模式也无需 generateStaticParams。
 *
 * 3. **键名由 zh-CN 单方面定义。** Messages 类型从 zh-CN 文案树反推，其它语言
 *    必须逐键对齐：漏译在 `tsc --noEmit` 里就报错，而不是上线后显示成裸键名。
 */

/** 全站支持的语言。顺序即语言选择器里的展示顺序。 */
export const LOCALES = ["zh-CN", "zh-TW", "en", "ja"] as const;

export type Locale = (typeof LOCALES)[number];

/** 未选择过语言时的兜底。与后端 core/config.py 的 DEFAULT_LOCALE 保持一致。 */
export const DEFAULT_LOCALE: Locale = "zh-CN";

export const LOCALE_STORAGE_KEY = "apiapia_locale";

/** 窄化未知值，供 localStorage / cookie / Accept-Language 的解析复用。 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * 插入变量。值会被原样替换进文案里的 `{name}` 占位符。
 *
 * 刻意允许 `undefined`：界面上大量文案要渲染后端字段，而这些字段大多是可选的
 * （`searchStatus.query`、`message.title`…）。如果这里只收 `string | number`，
 * 每个调用点都得先写 `?? ""`，而漏掉一个就是一次构建失败 —— 这类错误在 650 个
 * 调用点里迟早会重演。运行时（见 runtime.ts 的 interpolate）遇到 undefined 会
 * 在开发期告警并保留占位符，行为是可预期的。
 *
 * 需要确定文案完整时，调用方自己给兜底值：`t("k", { q: query ?? "" })`。
 */
export type TranslateValues = Record<string, string | number | undefined>;

/**
 * 把文案树摊平成点分键联合，例如 `nav.chat` / `time.minutesAgo_one`。
 *
 * 这样 `t("nav.chat")` 里的键是**编译期校验**的：写错一个字母立刻报错，
 * 而不会在运行时悄悄渲染出 `nav.chta`。拼错的键在编辑器里也拿不到自动补全。
 *
 * 不加 `extends` 约束：约束会让 `MessageKeys` 无法作用于递归展开的中间层，
 * 而这里恰恰需要它对任意嵌套深度展开。
 */
export type MessageKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKeys<T[K]>}`;
}[keyof T & string];

/**
 * 复数形式的基键。
 *
 * 英语需要区分单复数（1 minute ago / 2 minutes ago），中日文不需要。这个项目
 * 不引入完整的 ICU 复数规则（q / f / e / offset 那一套），只用最小可用的两档
 * `_one` / `_other` —— 覆盖英语的真实需求，同时让 zh-CN / ja 只需把两个键写成
 * 同样的内容，不会平白多出一堆冗余分支。
 *
 * 条件类型作用在裸类型参数 K 上，会自动对联合类型的每个成员分别求值，
 * 因此每个 `xxx_one` 键都会被映射回它的基键 `xxx`。
 */
export type PluralKeys<T> = MessageKeys<T> extends infer K
  ? K extends `${infer Base}_one`
    ? Base
    : never
  : never;

/**
 * 把 zh-CN 的字面量类型放宽成普通字符串类型。
 *
 * zh-CN 用 `as const` 固定成 `"确认"` 这样的字面量，是 `Messages` 的定义来源；
 * 但其它语言当然不能也写成 `"确认"`。Widen 之后结构不变、字面量消失，
 * 于是 `const en: Messages = {…}` 能校验「键齐全且不有多余键」，却不约束取值。
 */
export type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** 每个语言都自报家门，用于语言选择器展示。 */
export interface LocaleMeta {
  /**
   * 该语言自身的名称。
   *
   * 语言列表里必须用母语自称 —— 一个不懂英语的用户在英文界面里
   * 看到 "Japanese" 未必认得出那是日语，但一定认得出「日本語」。
   */
  nativeName: string;
  /** 英文名，用于日志、排查与需要英文字段的场合。 */
  englishName: string;
  /** 传给 Intl.* 的 BCP-47 标签。本项目四种语言都与 Locale 同形。 */
  intlTag: string;
  /**
   * 翻译功能里代表「本端语言」的短代号，用于「中 ⇋ 日」这类紧凑排版。
   *
   * 中文两系共用 ISO 639-1 的 `zh`，所以光看 isoCode 分不出简繁 ——
   * 简繁要靠 shortName 区分。
   */
  shortName: string;
  /**
   * ISO 639-1 语言码，**发给模型**用的。
   *
   * 刻意不用 Locale 本身：`zh-TW` 是带地区的标签，模型不认识；发 `zh` 它才知道
   * 说的是中文。
   */
  isoCode: string;
}