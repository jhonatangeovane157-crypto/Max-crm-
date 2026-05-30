import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

function getMessageText(payload: any) {
  const message = payload?.data?.message || payload?.message || {};

  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ""
  );
}

function getRemotePhone(payload: any) {
  const remoteJid =
    payload?.data?.key?.remoteJid ||
    payload?.key?.remoteJid ||
    payload?.data?.remoteJid ||
    "";

  return cleanPhone(remoteJid.split("@")[0]);
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await request.json();
    const phone = getRemotePhone(payload);
    const message = getMessageText(payload);
    const customerName = payload?.data?.pushName || payload?.pushName || "Cliente";
    const channelId = Deno.env.get("EVOLUTION_CHANNEL_ID") || null;

    if (!phone || !message) {
      return Response.json(
        { ok: true, ignored: true },
        { headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    let customer = existingCustomer;

    if (!customer) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: customerName,
          phone,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;
      customer = data;
    }

    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", customer.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversation = existingConversation;

    if (!conversation) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          customer_id: customer.id,
          channel_id: channelId,
          status: "open",
          priority: "normal",
          funnel_stage: "Novo Lead",
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;
      conversation = data;
    }

    const now = new Date().toISOString();

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_type: "customer",
      message,
      created_at: now,
    });

    if (messageError) throw messageError;

    await supabase
      .from("conversations")
      .update({
        status: conversation.status === "closed" ? "open" : conversation.status,
        last_message_at: now,
      })
      .eq("id", conversation.id);

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);

    return Response.json(
      { ok: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});
