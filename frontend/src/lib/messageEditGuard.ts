"use client";

/**
 * 是否正在编辑某条消息。
 *
 * 「回到前台刷新」会用服务端数据覆盖本地 messages，如果此刻用户正在消息内联
 * 编辑框里打字，未提交的内容就会被冲掉。这个模块级开关让 ChatMessageItem
 * 把编辑状态暴露出来，供 chat 页面在刷新前判断，避免 prop drilling。
 */
export const messageEditingRef: { current: boolean } = { current: false };

/**
 * 别名。chat/page 在刷新前读它，用动词式的名字读起来更顺；
 * 两个名字指向同一个对象，切换中不需要互相同步。
 */
export const messageEditGuardFlag = messageEditingRef;