import common from "./common";
import nav from "./nav";
import auth from "./auth";
import meta from "./meta";
import chat from "./chat";
import memory from "./memory";
import settings from "./settings";
import usage from "./usage";

/** English copy tree */
import type { Widen } from "../../types";
import type { messages as zhCN } from "../zh-CN";

type Messages = Widen<typeof zhCN>;

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