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

/** 日本語の文案。構造は zh-CN と 1 対 1 で検査される（値は string に緩められる）。 */
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