import common from "./common";
import nav from "./nav";
import auth from "./auth";
import meta from "./meta";
import chat from "./chat";
import memory from "./memory";
import settings from "./settings";
import usage from "./usage";

/**
 * 简体中文文案树 —— 全站文案的**唯一事实来源**。
 *
 * runtime.ts 用 `typeof messages` 反推出 MessageKey 联合类型，其它三种语言
 * 必须逐键对齐本文件（见 messages/en/index.ts 的 `Messages` 标注），
 * 漏一个键就会在 `tsc --noEmit` 里报错。
 *
 * 刻意**不在这里**收编后端错误消息：那些由后端按 Accept-Language 直接返回
 * 本地化后的 `detail`（见 backend/app/core/messages.py），前端原样展示。
 * 两边各存一份同样的 200 条文案，迟早会漂移 —— 而漂移出来的表现是
 * 「英文界面下弹出一条中文错误」，最难被发现。
 */
export const messages = {
  common,
  nav,
  auth,
  meta,
  chat,
  memory,
  settings,
  usage,
} as const;