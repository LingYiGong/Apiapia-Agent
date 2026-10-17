import ChatPage from "../page";

/**
 * 会话深链：/chat/<conversationId>
 */
export function generateStaticParams() {
  return [{ id: "session" }];
}

export default function SpecificChatPage({ params }: { params: { id: string } }) {
  return <ChatPage initialConversationId={params.id} />;
}
