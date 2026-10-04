import ChatPage from "../page";

export function generateStaticParams() {
  return [{ id: "session" }];
}

export default function SpecificChatPage() {
  return <ChatPage />;
}

