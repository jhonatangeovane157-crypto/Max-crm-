import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  MessageSquare,
  Users,
  CheckCircle2,
  Flame,
  Timer,
  Activity,
  Sparkles,
  ArrowUpRight,
  Crown,
  Radio,
  RefreshCw,
  Phone,
  Trophy,
  DollarSign,
} from "lucide-react";

const funnelStages = [
  "Novo Lead",
  "Primeiro Contato",
  "Orçamento",
  "Negociação",
  "Fechado",
  "Perdido",
];

function statusLabel(status) {
  if (status === "resolved") return "Resolvido";
  if (status === "closed") return "Fechado";
  if (status === "pending") return "Pendente";
  return "Aberto";
}

function getRoleLabel(role) {
  const roles = {
    admin: "Admin",
    supervisor: "Supervisor",
    seller: "Vendedor",
  };

  return roles[role] || "Equipe";
}

function getInitials(name) {
  if (!name) return "RC";

  return name
    .split(" ")
    .map((item) => item[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(date) {
  if (!date) return "-";

  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function diffMinutes(start, end) {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diff = endDate.getTime() - startDate.getTime();

  if (Number.isNaN(diff) || diff < 0) return null;

  return Math.round(diff / 60000);
}

export default function Dashboard() {
  const { user, member } = useAuth();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [messages, setMessages] = useState([]);

  async function loadDashboard() {
    setLoading(true);

    const [
      conversationsResponse,
      channelsResponse,
      teamResponse,
      messagesResponse,
    ] = await Promise.all([
      supabase
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
        .order("last_message_at", { ascending: false }),

      supabase.from("channels").select("*"),

      supabase.from("team_members").select("*").order("name", {
        ascending: true,
      }),

      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    if (!conversationsResponse.error) {
      setConversations(conversationsResponse.data || []);
    }

    if (!channelsResponse.error) {
      setChannels(channelsResponse.data || []);
    }

    if (!teamResponse.error) {
      setTeamMembers(teamResponse.data || []);
    }

    if (!messagesResponse.error) {
      setMessages(messagesResponse.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const open = conversations.filter(
      (item) => item.status === "open" || !item.status
    ).length;

    const pending = conversations.filter(
      (item) => item.status === "pending"
    ).length;

    const resolved = conversations.filter(
      (item) => item.status === "resolved" || item.status === "closed"
    ).length;

    const hotLeads = conversations.filter(
      (item) => item.priority === "urgent" || item.priority === "high"
    ).length;

    const onlineAgents = teamMembers.filter(
      (item) => item.status === "online" || item.status === "busy"
    ).length;

    const onlineChannels = channels.filter(
      (item) => item.status === "connected" || item.status === "online"
    ).length;

    const unassigned = conversations.filter((item) => !item.assigned_to).length;

    const salesClosed = conversations
      .filter(
        (item) =>
          item.funnel_stage === "Fechado" ||
          item.status === "closed" ||
          item.status === "resolved"
      )
      .reduce((acc, item) => acc + Number(item.closed_value || 0), 0);

    return {
      open,
      pending,
      resolved,
      hotLeads,
      onlineAgents,
      onlineChannels,
      unassigned,
      salesClosed,
    };
  }, [conversations, teamMembers, channels]);

  const urgentConversations = conversations.filter(
    (item) => item.priority === "urgent" || item.priority === "high"
  );

  const recentConversations = conversations.slice(0, 6);

  const firstName =
    member?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const avgResponseText = useMemo(() => {
    const responseTimes = conversations
      .map((conversation) => {
        const conversationMessages = messages.filter(
          (msg) => msg.conversation_id === conversation.id
        );

        const firstCustomerMessage = conversationMessages.find(
          (msg) => msg.sender_type !== "agent"
        );

        const firstAgentMessage = conversationMessages.find(
          (msg) =>
            msg.sender_type === "agent" &&
            firstCustomerMessage &&
            new Date(msg.created_at) > new Date(firstCustomerMessage.created_at)
        );

        return diffMinutes(
          firstCustomerMessage?.created_at,
          firstAgentMessage?.created_at
        );
      })
      .filter((value) => value !== null);

    if (!responseTimes.length) return "0m";

    const avg =
      responseTimes.reduce((acc, value) => acc + value, 0) /
      responseTimes.length;

    if (avg < 60) return `${Math.round(avg)}m`;

    const hours = Math.floor(avg / 60);
    const minutes = Math.round(avg % 60);

    return `${hours}h ${minutes}m`;
  }, [conversations, messages]);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-yellow-500" />
            <span className="text-[11px] font-semibold text-yellow-500/70 uppercase tracking-widest">
              MAX RCM
            </span>
          </div>

          <h1 className="text-3xl font-bold">
            {greeting}, <span className="text-yellow-500">{firstName}</span> 👋
          </h1>

          <p className="text-sm text-zinc-500 mt-1">
            Dashboard comercial com dados em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboard}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition"
          >
            <RefreshCw size={17} />
            Atualizar
          </button>

          <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl glass-card-gold">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[12px] font-medium text-emerald-400">
              Sistema Online
            </span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl glass-card-gold">
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-[12px] font-medium text-yellow-500">
              IA Ativa
            </span>
          </div>
        </div>
      </div>

      {urgentConversations.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-red-400" />
          </div>

          <div>
            <p className="text-[13px] font-semibold text-red-400">
              {urgentConversations.length} atendimento(s) urgente(s)
            </p>
            <p className="text-[11px] text-zinc-500">
              Requer atenção imediata.
            </p>
          </div>

          <Link
            to="/conversations"
            className="ml-auto flex items-center gap-1 text-[12px] text-red-400 hover:text-red-300 font-medium"
          >
            Ver agora <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total de Atendimentos"
          value={conversations.length}
          icon={MessageSquare}
          subtitle={`${stats.open} abertos`}
        />

        <StatCard
          title="Em Andamento"
          value={stats.open + stats.pending}
          icon={Activity}
          subtitle={`${stats.pending} pendentes`}
        />

        <StatCard
          title="Finalizados"
          value={stats.resolved}
          icon={CheckCircle2}
          subtitle="Resolvidos e fechados"
        />

        <StatCard
          title="Agentes Online"
          value={stats.onlineAgents}
          icon={Users}
          subtitle={`de ${teamMembers.length} na equipe`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Vendas Fechadas"
          value={formatMoney(stats.salesClosed)}
          icon={DollarSign}
          subtitle="Campo closed_value"
        />

        <StatCard
          title="Canais Online"
          value={stats.onlineChannels}
          icon={Radio}
          subtitle={`de ${channels.length} canais`}
        />

        <StatCard
          title="Tempo Médio Resp."
          value={avgResponseText}
          icon={Timer}
          subtitle="Primeira resposta"
        />

        <StatCard
          title="Leads Quentes"
          value={stats.hotLeads}
          icon={Flame}
          subtitle="Alta prioridade"
        />
      </div>

      {loading ? (
        <div className="text-zinc-500">Carregando dashboard...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ConversationChart conversations={conversations} />
            <TeamOverview teamMembers={teamMembers} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <SellerRanking
              teamMembers={teamMembers}
              conversations={conversations}
            />

            <LeadsBySeller
              teamMembers={teamMembers}
              conversations={conversations}
            />

            <ChannelsStatus channels={channels} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <RecentConversations
              conversations={recentConversations}
              teamMembers={teamMembers}
              messages={messages}
            />

            <FunnelSummary conversations={conversations} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, subtitle }) {
  return (
    <div className="glass-card-gold rounded-2xl p-6 hover:border-yellow-500/30 transition">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        <Icon className="w-5 h-5 text-yellow-500" />
      </div>

      <h2 className="text-3xl font-bold mt-4">{value}</h2>

      {subtitle && <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>}
    </div>
  );
}

function MemberAvatar({ member, className = "w-10 h-10 rounded-2xl" }) {
  return (
    <div
      className={`${className} bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-xs font-bold overflow-hidden shrink-0`}
    >
      {member?.avatar_url ? (
        <img
          src={member.avatar_url}
          alt={member.name || "Membro"}
          className="w-full h-full object-cover"
        />
      ) : (
        getInitials(member?.name)
      )}
    </div>
  );
}

function ConversationChart({ conversations }) {
  const chartData = useMemo(() => {
    const today = new Date();

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const total = conversations.filter((item) => {
        const itemDate = new Date(item.created_at || item.last_message_at);
        return itemDate >= dayStart && itemDate <= dayEnd;
      }).length;

      const resolvidos = conversations.filter((item) => {
        const itemDate = new Date(item.created_at || item.last_message_at);
        return (
          itemDate >= dayStart &&
          itemDate <= dayEnd &&
          (item.status === "resolved" || item.status === "closed")
        );
      }).length;

      return {
        dia: date.toLocaleDateString("pt-BR", { weekday: "short" }),
        atendimentos: total,
        resolvidos,
      };
    });
  }, [conversations]);

  const total = chartData.reduce((acc, item) => acc + item.atendimentos, 0);

  return (
    <div className="glass-card-gold rounded-2xl p-6 lg:col-span-2 min-h-[360px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Atendimentos da Semana</h2>
          <p className="text-sm text-zinc-500">Gráfico profissional Recharts</p>
          <h3 className="text-3xl font-bold mt-4">{total}</h3>
          <p className="text-xs text-zinc-500">total nos últimos 7 dias</p>
        </div>

        <div className="flex items-center gap-5 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Atendimentos
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Resolvidos
          </div>
        </div>
      </div>

      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>

              <linearGradient id="purpleFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="dia" stroke="rgba(255,255,255,0.45)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "#09090b",
                border: "1px solid rgba(234,179,8,0.25)",
                borderRadius: "14px",
                color: "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="atendimentos"
              stroke="#eab308"
              fill="url(#goldFill)"
              strokeWidth={3}
            />
            <Area
              type="monotone"
              dataKey="resolvidos"
              stroke="#a855f7"
              fill="url(#purpleFill)"
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TeamOverview({ teamMembers }) {
  const online = teamMembers.filter(
    (item) => item.status === "online" || item.status === "busy"
  );

  return (
    <div className="glass-card-gold rounded-2xl p-6 min-h-[360px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-bold text-lg">Equipe Online</h2>
          <p className="text-sm text-zinc-500">Status da operação</p>
        </div>

        <div className="rounded-2xl px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center">
          <p className="font-bold">{online.length}</p>
          <p className="text-xs">online</p>
        </div>
      </div>

      <div className="space-y-4">
        {teamMembers.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum membro cadastrado.</p>
        )}

        {teamMembers.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <MemberAvatar member={member} />

            <div className="min-w-0 flex-1">
              <p className="font-bold truncate">{member.name}</p>
              <p className="text-xs text-yellow-500">
                {getRoleLabel(member.role)}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`inline-flex w-2 h-2 rounded-full mr-2 ${
                  member.status === "online" || member.status === "busy"
                    ? "bg-emerald-400"
                    : "bg-zinc-600"
                }`}
              />
              <span className="text-xs text-zinc-500">
                {member.status === "online"
                  ? "Online"
                  : member.status === "busy"
                    ? "Atendendo"
                    : member.status === "away"
                      ? "Ausente"
                      : "Offline"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SellerRanking({ teamMembers, conversations }) {
  const ranking = teamMembers
    .map((member) => {
      const assigned = conversations.filter(
        (item) => item.assigned_to === member.id
      );

      const active = assigned.filter(
        (item) => item.status !== "resolved" && item.status !== "closed"
      );

      const resolved = assigned.filter(
        (item) =>
          item.status === "resolved" ||
          item.status === "closed" ||
          item.funnel_stage === "Fechado"
      );

      const value = resolved.reduce(
        (acc, item) => acc + Number(item.closed_value || 0),
        0
      );

      return {
        ...member,
        assigned: assigned.length,
        active: active.length,
        resolved: resolved.length,
        value,
      };
    })
    .sort((a, b) => b.active - a.active || b.assigned - a.assigned);

  return (
    <div className="glass-card-gold rounded-2xl p-6">
      <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-500" />
        Mais atendendo clientes
      </h2>

      <div className="space-y-4">
        {ranking.map((member, index) => (
          <div key={member.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-bold text-sm">
              {index + 1}
            </div>

            <MemberAvatar member={member} />

            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{member.name}</p>
              <p className="text-xs text-zinc-500">
                {member.active} em atendimento · {member.resolved} finalizados
              </p>
            </div>

            <span className="text-sm font-bold text-yellow-500">
              {member.active}
            </span>
          </div>
        ))}

        {ranking.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum atendente cadastrado.</p>
        )}
      </div>
    </div>
  );
}

function LeadsBySeller({ teamMembers, conversations }) {
  const data = teamMembers.map((member) => ({
    name: member.name,
    leads: conversations.filter((item) => item.assigned_to === member.id).length,
  }));

  return (
    <div className="glass-card-gold rounded-2xl p-6">
      <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
        <Flame size={18} className="text-yellow-500" />
        Leads por Vendedor
      </h2>

      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "#09090b",
                border: "1px solid rgba(234,179,8,0.25)",
                borderRadius: "14px",
                color: "#fff",
              }}
            />
            <Bar dataKey="leads" fill="#eab308" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChannelsStatus({ channels }) {
  const connected = channels.filter(
    (item) => item.status === "connected" || item.status === "online"
  );

  return (
    <div className="glass-card-gold rounded-2xl p-6">
      <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
        <Radio size={18} className="text-yellow-500" />
        Canais Conectados
      </h2>

      <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-4">
        <p className="text-3xl font-bold text-emerald-400">
          {connected.length}
        </p>
        <p className="text-xs text-zinc-500">de {channels.length} canais</p>
      </div>

      <div className="space-y-3">
        {channels.map((channel) => {
          const isConnected =
            channel.status === "connected" || channel.status === "online";

          return (
            <div
              key={channel.id}
              className="flex items-center justify-between border-b border-zinc-900 pb-3"
            >
              <div>
                <p className="font-semibold">{channel.name}</p>
                <p className="text-xs text-zinc-500">{channel.type}</p>
              </div>

              <span
                className={`text-xs px-3 py-1 rounded-full ${
                  isConnected
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-zinc-900 text-zinc-500"
                }`}
              >
                {isConnected ? "Conectado" : "Offline"}
              </span>
            </div>
          );
        })}

        {channels.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum canal cadastrado.</p>
        )}
      </div>
    </div>
  );
}

function RecentConversations({ conversations, teamMembers, messages }) {
  function getResponsible(id) {
    if (!id) return "-";
    return teamMembers.find((item) => item.id === id)?.name || "-";
  }

  function getLastMessage(conversationId) {
    const msg = [...messages]
      .reverse()
      .find((item) => item.conversation_id === conversationId);

    return msg?.message || "Sem mensagem recente";
  }

  return (
    <div className="glass-card-gold rounded-2xl p-6 xl:col-span-2">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <MessageSquare size={18} className="text-yellow-500" />
          Conversas Recentes
        </h2>

        <Link
          to="/conversations"
          className="text-xs text-yellow-500 flex items-center gap-1 hover:text-yellow-400"
        >
          Ver todas <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-widest text-zinc-500 border-b border-zinc-900">
              <th className="py-3">Cliente</th>
              <th>Canal</th>
              <th>Última mensagem</th>
              <th>Status</th>
              <th>Atendente</th>
              <th>Data</th>
            </tr>
          </thead>

          <tbody>
            {conversations.length === 0 && (
              <tr>
                <td className="py-5 text-zinc-500" colSpan="6">
                  Nenhuma conversa recente.
                </td>
              </tr>
            )}

            {conversations.map((conversation) => (
              <tr
                key={conversation.id}
                className="border-b border-zinc-900/70 hover:bg-white/[0.02]"
              >
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-xs font-bold">
                      {getInitials(conversation.customers?.name)}
                    </div>

                    <div>
                      <p className="font-semibold">
                        {conversation.customers?.name || "Cliente sem nome"}
                      </p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Phone size={11} />
                        {conversation.customers?.phone || "-"}
                      </p>
                    </div>
                  </div>
                </td>

                <td>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Radio size={15} />
                  </div>
                </td>

                <td className="text-zinc-500 max-w-[180px] truncate">
                  {getLastMessage(conversation.id)}
                </td>

                <td>
                  <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400">
                    {statusLabel(conversation.status)}
                  </span>
                </td>

                <td className="text-zinc-400">
                  {getResponsible(conversation.assigned_to)}
                </td>

                <td className="text-zinc-500">
                  <div>{formatDate(conversation.last_message_at)}</div>
                  <div className="text-xs">
                    {formatTime(conversation.last_message_at)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FunnelSummary({ conversations }) {
  const max = Math.max(
    1,
    ...funnelStages.map(
      (stage) =>
        conversations.filter((item) => (item.funnel_stage || "Novo Lead") === stage)
          .length
    )
  );

  return (
    <div className="glass-card-gold rounded-2xl p-6">
      <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
        <Activity size={18} className="text-yellow-500" />
        Resumo do Funil
      </h2>

      <div className="space-y-4">
        {funnelStages.map((stage) => {
          const value = conversations.filter(
            (item) => (item.funnel_stage || "Novo Lead") === stage
          ).length;

          const width = `${Math.max(8, (value / max) * 100)}%`;

          return (
            <div key={stage}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">{stage}</span>
                <span className="font-bold">{value}</span>
              </div>

              <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-yellow-500"
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
