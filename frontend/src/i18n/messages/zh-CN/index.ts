import common from "./common";
import nav from "./nav";
import auth from "./auth";
import meta from "./meta";
import chat from "./chat";
import memory from "./memory";
import settings from "./settings";
import usage from "./usage";

/** 简体中文文案树 */
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