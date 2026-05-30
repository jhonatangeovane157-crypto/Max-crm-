import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";
import { hasEvolutionConfig, sendText } from "@/services/evolutionApi";
import {
  Search,
  MessageSquare,
  Send,
  User,
  Bot,
  Paperclip,
  Smile,
  MoreVertical,
  Phone,
  CheckCircle2,
  Sparkles,
  Clock,
  Flame,
  Mail,
  Copy,
  Tag,
  UserCheck,
  GitBranch,
  Inbox,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const aiSuggestion =
  "Olá! Obrigado pelo contato. Posso te passar mais detalhes e montar um atendimento personalizado para você.";

const funnelStages = [
  "Novo Lead",
  "Primeiro Contato",
  "Orçamento",
  "Negociação",
  "Fechado",
  "Perdido",
];

const tagOptions = ["Vendas", "Suporte", "Financeiro", "Pós-venda"];

const customerTypes = [
  { value: "new", label: "Cliente Novo" },
  { value: "potential", label: "Cliente Potencial" },
  { value: "good", label: "Cliente Bom" },
  { value: "loyal", label: "Cliente Fiel" },
  { value: "vip", label: "Cliente VIP" },
  { value: "problem", label: "Cliente Problema" },
  { value: "lost", label: "Cliente Perdido" },
];

function formatTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  if (status === "resolved") return "Resolvido";
  if (status === "closed") return "Fechado";
  if (status === "pending") return "Pendente";
  return "Aberto";
}

function priorityLabel(priority) {
  if (priority === "urgent") return "Urgente";
  if (priority === "high") return "Alta";
  if (priority === "low") return "Baixa";
  return "Normal";
}

function customerTypeLabel(type) {
  const found = customerTypes.find((item) => item.value === type);
  return found?.label || "Cliente Novo";
}

function cleanPhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function getWhatsAppNumber(phone) {
  const cleaned = cleanPhone(phone);

  if (!cleaned) return "";

  return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
}

export default function Conversations() {
  const { member } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all");
  const [showCustomerPanel, setShowCustomerPanel] = useState(true);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");

  const messagesEndRef = useRef(null);
  const selectedIdRef = useRef(null);

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
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        *,
        customers (
          id,
          name,
          phone,
          email,
          notes
        ),
        channels (
          id,
          name,
          type,
          phone_number,
          instance_name,
          base_url,
          api_key,
          api_token,
          webhook_url,
          status,
          connection_status
        )
      `)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    let list = data || [];

    if (member?.role === "seller") {
      list = list.filter(
        (item) => !item.assigned_to || item.assigned_to === member?.id
      );
    }

    setConversations(list);

    if (!selectedIdRef.current && list.length) {
      setSelected(list[0]);
      selectedIdRef.current = list[0].id;
      return;
    }

    if (selectedIdRef.current) {
      const updatedSelected = list.find(
        (item) => item.id === selectedIdRef.current
      );

      if (updatedSelected) {
        setSelected(updatedSelected);
      } else {
        setSelected(list[0] || null);
        selectedIdRef.current = list[0]?.id || null;
      }
    }
  }, [member?.id, member?.role]);

  async function loadMessages(conversationId) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error) setMessages(data || []);
  }

  useEffect(() => {
    loadTeamMembers();
    loadConversations();
  }, [member?.id, loadTeamMembers, loadConversations]);

  useEffect(() => {
    if (!selected?.id) return;

    selectedIdRef.current = selected.id;
    loadMessages(selected.id);

    const channel = supabase
      .channel(`messages-${selected.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selected.id}`,
        },
        (payload) => {
          setMessages((current) => {
            const exists = current.some((msg) => msg.id === payload.new.id);
            if (exists) return current;
            return [...current, payload.new];
          });

          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected?.id, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function getMemberName(id) {
    if (!id) return "Sem responsável";
    const foundMember = teamMembers.find((item) => item.id === id);
    return foundMember?.name || "Não encontrado";
  }

  const queueStats = useMemo(() => {
    const unassigned = conversations.filter((item) => !item.assigned_to).length;
    const mine = conversations.filter(
      (item) => item.assigned_to === member?.id
    ).length;
    const resolved = conversations.filter(
      (item) => item.status === "resolved" || item.status === "closed"
    ).length;

    return { unassigned, mine, resolved };
  }, [conversations, member?.id]);

  const filteredConversations = useMemo(() => {
    const term = search.toLowerCase();

    return conversations.filter((conversation) => {
      const name = conversation.customers?.name?.toLowerCase() || "";
      const phone = conversation.customers?.phone || "";
      const status = conversation.status || "";
      const priority = conversation.priority || "";
      const tag = conversation.tag || "";
      const stage = conversation.funnel_stage || "";
      const customerType = conversation.customer_type || "";

      const matchesSearch =
        name.includes(term) ||
        phone.includes(term) ||
        status.toLowerCase().includes(term) ||
        priority.toLowerCase().includes(term) ||
        tag.toLowerCase().includes(term) ||
        stage.toLowerCase().includes(term) ||
        customerType.toLowerCase().includes(term);

      const matchesAgent =
        filterAgent === "all" ||
        (filterAgent === "unassigned" && !conversation.assigned_to) ||
        conversation.assigned_to === filterAgent;

      const matchesStage =
        filterStage === "all" || conversation.funnel_stage === filterStage;

      const matchesQuickFilter =
        quickFilter === "all" ||
        (quickFilter === "unassigned" && !conversation.assigned_to) ||
        (quickFilter === "mine" && conversation.assigned_to === member?.id) ||
        (quickFilter === "resolved" &&
          (conversation.status === "resolved" ||
            conversation.status === "closed"));

      return matchesSearch && matchesAgent && matchesStage && matchesQuickFilter;
    });
  }, [
    conversations,
    search,
    filterAgent,
    filterStage,
    quickFilter,
    member?.id,
  ]);

  async function updateConversationField(field, value) {
    if (!selected?.id) return;

    const finalValue = value === "none" ? null : value;

    const { error } = await supabase
      .from("conversations")
      .update({
        [field]: finalValue,
      })
      .eq("id", selected.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSelected((current) =>
      current ? { ...current, [field]: finalValue } : current
    );

    loadConversations();
  }

  async function takeConversation() {
    if (!selected?.id) return;

    if (!member?.id) {
      alert("Seu usuário ainda não está vinculado a um membro da equipe.");
      return;
    }

    const { error } = await supabase
      .from("conversations")
      .update({
        assigned_to: member.id,
        status: "pending",
      })
      .eq("id", selected.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSelected((current) =>
      current
        ? {
            ...current,
            assigned_to: member.id,
            status: "pending",
          }
        : current
    );

    await loadConversations();
  }

  function openTransferModal() {
    if (!selected?.id) return;
    setTransferTo(selected.assigned_to || "");
    setTransferModalOpen(true);
  }

  function closeTransferModal() {
    setTransferModalOpen(false);
    setTransferTo("");
  }

  async function transferConversation(e) {
    e.preventDefault();

    if (!selected?.id) return;

    if (!transferTo) {
      alert("Selecione um vendedor para transferir.");
      return;
    }

    const { error } = await supabase
      .from("conversations")
      .update({
        assigned_to: transferTo,
        status: "pending",
      })
      .eq("id", selected.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSelected((current) =>
      current
        ? {
            ...current,
            assigned_to: transferTo,
            status: "pending",
          }
        : current
    );

    closeTransferModal();
    loadConversations();
  }

  function callCustomer() {
    const phone = cleanPhone(selected?.customers?.phone);

    if (!phone) {
      alert("Cliente sem telefone cadastrado.");
      return;
    }

    window.open(`https://wa.me/${getWhatsAppNumber(phone)}`, "_blank");
  }

  async function sendMessage(e) {
    e.preventDefault();

    if (!message.trim() || !selected?.id) return;

    const text = message.trim();
    setMessage("");

    const { error } = await supabase.from("messages").insert([
      {
        conversation_id: selected.id,
        sender_type: "agent",
        message: text,
      },
    ]);

    if (error) {
      alert(error.message);
      setMessage(text);
      return;
    }

    if (hasEvolutionConfig(selected.channels)) {
      try {
        await sendText({
          channel: selected.channels,
          number: selected.customers?.phone,
          text,
        });
      } catch (evolutionError) {
        console.error(evolutionError);
        alert(
          `Mensagem salva no CRM, mas não foi enviada pela Evolution API: ${evolutionError.message}`
        );
      }
    }

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", selected.id);
  }

  function useAiSuggestion() {
    setMessage(aiSuggestion);
  }

  function copyPhone() {
    const phone = selected?.customers?.phone;
    if (phone) navigator.clipboard.writeText(phone);
  }

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">
      <aside className="w-[400px] border-r border-zinc-900 bg-[#070707] flex flex-col">
        <div className="p-4 border-b border-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Conversas</h1>
              <p className="text-xs text-zinc-500">
                {filteredConversations.length} atendimento(s)
              </p>
            </div>

            <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <MessageSquare className="text-yellow-500" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <QueueButton
              active={quickFilter === "unassigned"}
              icon={Inbox}
              label="Fila"
              value={queueStats.unassigned}
              onClick={() =>
                setQuickFilter((current) =>
                  current === "unassigned" ? "all" : "unassigned"
                )
              }
            />

            <QueueButton
              active={quickFilter === "mine"}
              icon={UserCheck}
              label="Meus"
              value={queueStats.mine}
              onClick={() =>
                setQuickFilter((current) =>
                  current === "mine" ? "all" : "mine"
                )
              }
            />

            <QueueButton
              active={quickFilter === "resolved"}
              icon={CheckCircle2}
              label="Finalizados"
              value={queueStats.resolved}
              onClick={() =>
                setQuickFilter((current) =>
                  current === "resolved" ? "all" : "resolved"
                )
              }
            />
          </div>

          <div className="relative mb-3">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />

            <input
              placeholder="Buscar por nome, telefone, status..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 outline-none text-sm focus:border-yellow-500/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-yellow-500/40"
            >
              <option value="all">Todos responsáveis</option>
              <option value="unassigned">Sem responsável</option>
              {teamMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:border-yellow-500/40"
            >
              <option value="all">Todas etapas</option>
              {funnelStages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredConversations.length === 0 && (
            <div className="p-6 text-zinc-500 text-sm">
              Nenhuma conversa encontrada.
            </div>
          )}

          {filteredConversations.map((conversation) => {
            const active = selected?.id === conversation.id;
            const resolved =
              conversation.status === "resolved" || conversation.status === "closed";

            return (
              <button
                key={conversation.id}
                onClick={() => setSelected(conversation)}
                className={`w-full text-left p-4 border-b border-zinc-900 hover:bg-white/5 transition flex gap-3 ${
                  active ? "bg-yellow-500/10 border-r-2 border-r-yellow-500" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500/25 to-yellow-900/10 flex items-center justify-center">
                    <MessageSquare className="text-yellow-500" size={20} />
                  </div>

                  <span
                    className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#070707] ${
                      resolved ? "bg-blue-400" : "bg-emerald-400"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <h3 className="font-bold truncate">
                      {conversation.customers?.name || "Cliente sem nome"}
                    </h3>

                    <span className="text-[10px] text-zinc-500">
                      {statusLabel(conversation.status)}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 truncate mt-1">
                    {conversation.customers?.phone || "Sem telefone"}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-1 rounded-full">
                      WhatsApp
                    </span>

                    <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-full flex items-center gap-1">
                      <Flame size={10} />
                      {priorityLabel(conversation.priority)}
                    </span>

                    <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-1 rounded-full">
                      {getMemberName(conversation.assigned_to)}
                    </span>

                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">
                      {customerTypeLabel(conversation.customer_type)}
                    </span>

                    {conversation.funnel_stage && (
                      <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-1 rounded-full">
                        {conversation.funnel_stage}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-[#050505] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_20px_20px,#facc15_1px,transparent_0)] [background-size:28px_28px]" />

        {selected ? (
          <>
            <div className="h-20 border-b border-zinc-900 px-6 flex items-center justify-between bg-[#070707]/95 backdrop-blur relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <User className="text-yellow-500" />
                </div>

                <div>
                  <h2 className="font-bold text-lg">
                    {selected.customers?.name || "Cliente sem nome"}
                  </h2>

                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{selected.customers?.phone || "Sem telefone"}</span>
                    <span>·</span>
                    <span>WhatsApp</span>
                    <span>·</span>
                    <span className="text-emerald-400">
                      {customerTypeLabel(selected.customer_type)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyPhone}
                  className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center"
                  title="Copiar telefone"
                >
                  <Phone size={18} />
                </button>

                <button
                  onClick={callCustomer}
                  className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center gap-2 text-sm hover:bg-emerald-500/20 transition"
                >
                  <Phone size={16} />
                  Chamar
                </button>

                {!selected?.assigned_to && (
                  <button
                    onClick={takeConversation}
                    className="px-4 py-2 rounded-xl bg-yellow-500 text-black font-bold flex items-center gap-2 hover:bg-yellow-400 transition"
                  >
                    <UserPlus size={16} />
                    Assumir
                  </button>
                )}

                <button
                  onClick={openTransferModal}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white flex items-center gap-2 text-sm hover:bg-zinc-800 transition"
                >
                  <Users size={16} />
                  Transferir
                </button>

                <select
                  value={selected.customer_type || "new"}
                  onChange={(e) =>
                    updateConversationField("customer_type", e.target.value)
                  }
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-yellow-500"
                >
                  {customerTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowCustomerPanel(true)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm hover:bg-zinc-800 transition"
                >
                  Dados do Cliente
                </button>

                <button className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center">
                  <MoreVertical size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4 relative z-10">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                  <MessageSquare size={42} className="mb-4 text-yellow-500" />
                  <p>Nenhuma mensagem ainda.</p>
                  <p className="text-sm">Envie a primeira mensagem abaixo.</p>
                </div>
              )}

              {messages.map((msg) => {
                const isAgent = msg.sender_type === "agent";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                        isAgent
                          ? "bg-yellow-500 text-black rounded-br-sm"
                          : "bg-zinc-900 text-white rounded-bl-sm border border-zinc-800"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.message}
                      </p>

                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] mt-2 ${
                          isAgent ? "text-black/60" : "text-zinc-500"
                        }`}
                      >
                        <Clock size={10} />
                        <span>{formatTime(msg.created_at)}</span>
                        {isAgent && <span>✓✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 pt-3 bg-[#070707] border-t border-zinc-900 relative z-10">
              <button
                type="button"
                onClick={useAiSuggestion}
                className="mb-3 inline-flex items-center gap-2 text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-3 py-2 rounded-xl hover:bg-yellow-500/20 transition"
              >
                <Sparkles size={14} />
                Usar sugestão da IA
              </button>

              <form
                onSubmit={sendMessage}
                className="pb-4 flex items-center gap-3"
              >
                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-zinc-400"
                >
                  <Paperclip size={18} />
                </button>

                <button
                  type="button"
                  className="w-10 h-10 rounded-xl hover:bg-white/5 flex items-center justify-center text-zinc-400"
                >
                  <Smile size={18} />
                </button>

                <input
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-yellow-500/40"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />

                <button className="w-12 h-12 rounded-xl bg-yellow-500 text-black flex items-center justify-center hover:bg-yellow-400 transition">
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 relative z-10">
            <Bot size={52} className="text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold text-white">
              Selecione uma conversa
            </h2>
            <p className="mt-2">Escolha um atendimento na lista para iniciar.</p>
          </div>
        )}
      </main>

      {selected && showCustomerPanel && (
        <>
          <div
            onClick={() => setShowCustomerPanel(false)}
            className="fixed inset-0 bg-black/40 z-40"
          />

          <aside className="fixed right-0 top-0 h-screen w-[420px] z-50 border-l border-zinc-800 bg-[#070707] p-5 overflow-auto shadow-2xl shadow-black">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Dados do Cliente</h2>

            <button
              onClick={() => setShowCustomerPanel(false)}
              className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          <div className="glass-card-gold rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-yellow-500/10">
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                <User className="text-yellow-500" />
              </div>

              <div>
                <p className="font-bold">{selected.customers?.name || "-"}</p>
                <p className="text-xs text-zinc-500">
                  {customerTypeLabel(selected.customer_type)}
                </p>
              </div>
            </div>

            <SmallInfo
              icon={Phone}
              label="Telefone"
              value={selected.customers?.phone || "-"}
            />
            <SmallInfo
              icon={Mail}
              label="Email"
              value={selected.customers?.email || "-"}
            />
            <SmallInfo
              icon={Tag}
              label="Status do Atendimento"
              value={statusLabel(selected.status)}
            />
            <SmallInfo
              icon={UserCheck}
              label="Tipo de Cliente"
              value={customerTypeLabel(selected.customer_type)}
            />

            {selected.customers?.notes && (
              <div>
                <p className="text-xs text-zinc-500">Observações</p>
                <p className="text-sm text-zinc-300">
                  {selected.customers.notes}
                </p>
              </div>
            )}
          </div>

          <div className="glass-card-gold rounded-2xl p-4 mt-4">
            <h3 className="font-bold mb-4">CRM do atendimento</h3>

            <div className="space-y-4">
              <SelectBox
                icon={UserCheck}
                label="Responsável"
                value={selected.assigned_to || "none"}
                onChange={(value) =>
                  updateConversationField("assigned_to", value)
                }
              >
                <option value="none">Sem responsável</option>
                {teamMembers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectBox>

              <SelectBox
                icon={GitBranch}
                label="Etapa do funil"
                value={selected.funnel_stage || "none"}
                onChange={(value) =>
                  updateConversationField("funnel_stage", value)
                }
              >
                <option value="none">Sem etapa</option>
                {funnelStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </SelectBox>

              <SelectBox
                icon={Tag}
                label="Etiqueta"
                value={selected.tag || "none"}
                onChange={(value) => updateConversationField("tag", value)}
              >
                <option value="none">Sem etiqueta</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </SelectBox>

              <SelectBox
                icon={UserCheck}
                label="Tipo de Cliente"
                value={selected.customer_type || "new"}
                onChange={(value) => updateConversationField("customer_type", value)}
              >
                {customerTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </SelectBox>
            </div>
          </div>

          <div className="glass-card-gold rounded-2xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-yellow-500" size={16} />
              <h3 className="font-bold">IA Sugerida</h3>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed">
              {aiSuggestion}
            </p>

            <button
              onClick={useAiSuggestion}
              className="mt-4 w-full bg-yellow-500 text-black font-bold rounded-xl p-3 hover:bg-yellow-400 transition flex items-center justify-center gap-2"
            >
              <Copy size={16} />
              Usar resposta
            </button>
          </div>

          <div className="glass-card-gold rounded-2xl p-4 mt-4">
            <h3 className="font-bold mb-3">Resumo</h3>

            <div className="space-y-2 text-sm text-zinc-400">
              <div className="flex justify-between">
                <span>Mensagens</span>
                <span className="text-white">{messages.length}</span>
              </div>

              <div className="flex justify-between">
                <span>Responsável</span>
                <span className="text-white">
                  {getMemberName(selected.assigned_to)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Funil</span>
                <span className="text-white">
                  {selected.funnel_stage || "-"}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Etiqueta</span>
                <span className="text-white">{selected.tag || "-"}</span>
              </div>

              <div className="flex justify-between">
                <span>Tipo</span>
                <span className="text-white">
                  {customerTypeLabel(selected.customer_type)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Prioridade</span>
                <span className="text-yellow-500">
                  {priorityLabel(selected.priority)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Canal</span>
                <span>WhatsApp</span>
              </div>
            </div>
          </div>
          </aside>
        </>
      )}

      {transferModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-5">
          <form
            onSubmit={transferConversation}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold">Transferir atendimento</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Escolha o vendedor responsável.
                </p>
              </div>

              <button
                type="button"
                onClick={closeTransferModal}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
            >
              <option value="">Selecione um vendedor</option>
              {teamMembers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.role}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeTransferModal}
                className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              >
                Transferir
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function QueueButton({ active, icon: Icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition ${
        active
          ? "bg-yellow-500 text-black border-yellow-500"
          : "bg-zinc-950 border-zinc-800 hover:border-yellow-500/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon size={16} />
        <span className="font-bold text-lg">{value}</span>
      </div>
      <p
        className={`text-[11px] mt-1 ${
          active ? "text-black/70" : "text-zinc-500"
        }`}
      >
        {label}
      </p>
    </button>
  );
}

function SmallInfo({ icon: Icon, label, value }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 flex items-center gap-2">
        <Icon size={13} />
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}

function SelectBox({ icon: Icon, label, value, onChange, children }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 flex items-center gap-2 mb-2">
        <Icon size={13} />
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white text-sm"
      >
        {children}
      </select>
    </div>
  );
}
