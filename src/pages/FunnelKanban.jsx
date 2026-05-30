import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  MessageSquare,
  Phone,
  User,
  ArrowRight,
  ArrowLeft,
  GitBranch,
  Tag,
  UserCheck,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

const stages = [
  "Novo Lead",
  "Primeiro Contato",
  "Orçamento",
  "Negociação",
  "Fechado",
  "Perdido",
];

export default function FunnelKanban() {
  const [conversations, setConversations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTeamMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("name", { ascending: true });

    if (!error) {
      setTeamMembers(data || []);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        customers (
          id,
          name,
          phone,
          email
        )
      `)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Erro ao carregar funil.");
    } else {
      setConversations(data || []);
    }

    setLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await loadTeamMembers();
    await loadConversations();
    setLoading(false);
  }, [loadTeamMembers, loadConversations]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function getMemberName(id) {
    if (!id) return "Sem responsável";

    const member = teamMembers.find((item) => item.id === id);

    return member?.name || "Não encontrado";
  }

  function getStageItems(stage) {
    return conversations.filter((item) => {
      const currentStage = item.funnel_stage || "Novo Lead";
      return currentStage === stage;
    });
  }

  async function moveConversation(conversation, direction) {
    const currentStage = conversation.funnel_stage || "Novo Lead";
    const currentIndex = stages.indexOf(currentStage);
    const nextIndex = currentIndex + direction;

    if (nextIndex < 0 || nextIndex >= stages.length) return;

    const nextStage = stages[nextIndex];

    const { error } = await supabase
      .from("conversations")
      .update({
        funnel_stage: nextStage,
      })
      .eq("id", conversation.id);

    if (error) {
      alert(error.message);
      return;
    }

    setConversations((current) =>
      current.map((item) =>
        item.id === conversation.id
          ? { ...item, funnel_stage: nextStage }
          : item
      )
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
            <GitBranch size={24} />
          </div>

          <div>
            <h1 className="text-3xl font-bold">Funil de Atendimento</h1>
            <p className="text-zinc-500 mt-1">
              Acompanhe os leads por etapa e responsável.
            </p>
          </div>
        </div>

        <button
          onClick={loadAll}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
        >
          <RefreshCw size={18} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-500">Carregando funil...</div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-5 h-[calc(100vh-150px)]">
          {stages.map((stage) => {
            const items = getStageItems(stage);

            return (
              <div
                key={stage}
                className="w-[350px] min-w-[350px] bg-[#070707] border border-zinc-900 rounded-3xl flex flex-col"
              >
                <div className="p-4 border-b border-zinc-900">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm">{stage}</h2>

                    <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full">
                      {items.length}
                    </span>
                  </div>
                </div>

                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-xs text-zinc-600 text-center py-8">
                      Ninguém lidera nesta etapa.
                    </div>
                  ) : (
                    items.map((conversation) => (
                      <LeadCard
                        key={conversation.id}
                        conversation={conversation}
                        responsibleName={getMemberName(conversation.assigned_to)}
                        onMoveLeft={() => moveConversation(conversation, -1)}
                        onMoveRight={() => moveConversation(conversation, 1)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({ conversation, responsibleName, onMoveLeft, onMoveRight }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 hover:border-yellow-500 transition-all cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0">
          <MessageSquare size={19} />
        </div>

        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate">
            {conversation.customers?.name || "Cliente sem nome"}
          </h3>

          <p className="text-xs text-zinc-500 truncate flex items-center gap-1 mt-1">
            <Phone size={12} />
            {conversation.customers?.phone || "Sem telefone"}
          </p>
        </div>
      </div>

      <div className="space-y-2 text-xs text-zinc-400 mb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <UserCheck size={12} />
            Atendente
          </span>
          <span className="text-white text-right">{responsibleName}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <User size={12} />
            Status
          </span>
          <span>{conversation.status || "open"}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1">
            <Tag size={12} />
            Etiqueta
          </span>
          <span>{conversation.tag || "-"}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onMoveLeft}
          className="flex-1 flex items-center justify-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-2 text-xs transition"
        >
          <ArrowLeft size={14} />
          Voltar
        </button>

        <button
          onClick={onMoveRight}
          className="flex-1 flex items-center justify-center gap-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl py-2 text-xs transition"
        >
          Avançar
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
