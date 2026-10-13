import common from "./common";
import nav from "./nav";
import auth from "./auth";
import meta from "./meta";
import chat from "./chat";
import memory from "./memory";
import settings from "./settings";
import usage from "./usage";

/**
 * English copy tree.
 *
 * Annotated as `Messages` so the compiler checks it against zh-CN key for key:
 * a missing key, a typo, or a stray extra key all fail `tsc --noEmit`.
 * Only the **structure** is checked — values are widened to `string`, so this
 * file is free to hold English text where zh-CN holds Chinese.
 */
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