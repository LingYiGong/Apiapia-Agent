import common from "./common";
import nav from "./nav";
import auth from "./auth";
import meta from "./meta";
import chat from "./chat";
import memory from "./memory";
import settings from "./settings";
import usage from "./usage";

import type { Widen } from "../../types";
import type { messages as zhCN } from "../zh-CN";

type Messages = Widen<typeof zhCN>;

/**
 * 繁體中文文案。結構與 zh-CN 一一對應，由編譯器逐鍵檢查；
 * 用詞採台灣慣用語（影片／資料／預設／網路），不是單純的簡繁轉換。
 */
export const messages: Messages = {
  common,
  nav,
  auth,
  meta,
  chat,
  memory,
  settings,
  usage,
};