import { supabase } from "@/lib/supabase";

export function subscribeToMessages(conversationId, callback) {
  if (!conversationId) return null;

  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return channel;
}

export function unsubscribe(channel) {
  if (channel) {
    supabase.removeChannel(channel);
  }
}