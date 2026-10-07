import ChatPage from "../page";

/**
 * 会话深链：/chat/<conversationId>
 *
 * 此前这个文件用 generateStaticParams 返回一个假的 `[{id:"session"}]` 骗过
 * 静态导出，然后直接渲染 ChatPage 且**从不读 params**。结果是任何
 * /chat/<任意字符串> 都能打开页面，却永远进不去那个会话 —— 一个看起来能用、
 * 实际静默失效的深链。
 *
 * 现在把 id 透传给 ChatPage，由它在会话列表里校验后打开。
 * generateStaticParams 仍然需要（output: "export" 要求所有动态段有静态外壳），
 * 但它生成的只是一个占位页，真正的数据在客户端按 URL 取。
 *
 * params 按 Next 14 的形态标注（普通对象，不是 Promise）。
 */
export function generateStaticParams() {
  return [{ id: "session" }];
}

export default function SpecificChatPage({ params }: { params: { id: string } }) {
  return <ChatPage initialConversationId={params.id} />;
}
