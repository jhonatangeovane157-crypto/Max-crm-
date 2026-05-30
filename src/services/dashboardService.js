import { supabase } from "@/lib/supabase";

export async function getDashboardStats() {
  const [
    customersResult,
    channelsResult,
    conversationsResult,
    messagesResult,
    teamResult,
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("channels").select("*", { count: "exact", head: true }),
    supabase.from("conversations").select("*"),
    supabase.from("messages").select("*", { count: "exact", head: true }),
    supabase.from("team_members").select("*"),
  ]);

  const conversations = conversationsResult.data || [];
  const team = teamResult.data || [];

  return {
    customers: customersResult.count || 0,
    channels: channelsResult.count || 0,
    conversations: conversations.length,
    messages: messagesResult.count || 0,
    open: conversations.filter((c) => c.status === "open").length,
    resolved: conversations.filter((c) => c.status === "resolved").length,
    hotLeads: conversations.filter(
      (c) => c.priority === "urgent" || c.priority === "high"
    ).length,
    teamOnline: team.filter((m) => m.status === "online").length,
    teamTotal: team.length,
  };
}