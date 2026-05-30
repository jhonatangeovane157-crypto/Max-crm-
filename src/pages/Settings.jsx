import { useEffect, useMemo, useState } from "react";
import {
  Settings as SettingsIcon,
  Users,
  Crown,
  Shield,
  Activity,
  RefreshCw,
  UserPlus,
  History,
  Trophy,
  Clock,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "seller", label: "Vendedor" },
];

function getRoleLabel(role) {
  const roles = {
    admin: "Admin",
    supervisor: "Supervisor",
    seller: "Vendedor",
  };

  return roles[role] || "Vendedor";
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
  if (!date) return "Nunca";

  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDefaultPermissionsByRole(role) {
  if (role === "admin") {
    return {
      can_view_all: true,
      can_transfer: true,
      can_manage_team: true,
      can_manage_channels: true,
      can_send_notifications: true,
      can_change_roles: true,
    };
  }

  if (role === "supervisor") {
    return {
      can_view_all: true,
      can_transfer: true,
      can_manage_team: true,
      can_manage_channels: false,
      can_send_notifications: true,
      can_change_roles: false,
    };
  }

  return {
    can_view_all: false,
    can_transfer: true,
    can_manage_team: false,
    can_manage_channels: false,
    can_send_notifications: false,
    can_change_roles: false,
  };
}

export default function Settings() {
  const { member, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    role: "seller",
    password: "",
  });

  async function loadData() {
    setLoading(true);

    const [membersRes, conversationsRes, logsRes] = await Promise.all([
      supabase.from("team_members").select("*").order("name", { ascending: true }),
      supabase.from("conversations").select("id, assigned_to, status, funnel_stage"),
      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (!membersRes.error) setMembers(membersRes.data || []);
    if (!conversationsRes.error) setConversations(conversationsRes.data || []);
    if (!logsRes.error) setAuditLogs(logsRes.data || []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createAudit(action, details) {
    await supabase.from("audit_logs").insert({
      user_id: member?.id || null,
      member_id: member?.id || null,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  }

  async function updateMember(memberId, updates, actionText) {
    if (!isAdmin()) {
      alert("Somente Admin pode alterar configurações.");
      return;
    }

    const { error } = await supabase
      .from("team_members")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      alert(error.message);
      return;
    }

    await createAudit(actionText, JSON.stringify(updates));
    loadData();
  }

  async function handleCreateMember(e) {
    e.preventDefault();

    if (!isAdmin()) {
      alert("Somente Admin pode criar membros.");
      return;
    }

    if (!newMember.name.trim() || !newMember.email.trim()) {
      alert("Preencha nome e email.");
      return;
    }

    const { error } = await supabase.from("team_members").insert({
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      status: "offline",
      is_active: true,
      permissions: buildDefaultPermissionsByRole(newMember.role),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    await createAudit(
      "Novo membro criado",
      `${newMember.name} foi cadastrado como ${getRoleLabel(newMember.role)}`
    );

    setNewMember({
      name: "",
      email: "",
      role: "seller",
      password: "",
    });

    loadData();

    alert(
      "Membro criado. Para login real, crie também o usuário em Authentication > Users no Supabase com o mesmo email."
    );
  }

  const performance = useMemo(() => {
    return members
      .map((item) => {
        const assigned = conversations.filter((conv) => conv.assigned_to === item.id);

        const resolved = assigned.filter(
          (conv) =>
            conv.status === "resolved" ||
            conv.status === "closed" ||
            conv.funnel_stage === "Fechado"
        );

        const conversion =
          assigned.length > 0 ? Math.round((resolved.length / assigned.length) * 100) : 0;

        return {
          ...item,
          assigned: assigned.length,
          resolved: resolved.length,
          conversion,
        };
      })
      .sort((a, b) => b.resolved - a.resolved);
  }, [members, conversations]);

  const bestSeller = performance[0];

  return (
    <div className="min-h-screen bg-black text-white p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="text-yellow-500" size={18} />
            <span className="text-xs uppercase tracking-widest text-yellow-500">
              Configurações
            </span>
          </div>

          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <p className="text-zinc-500 mt-2">
            Controle login, cargos, permissões, auditoria e performance.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
        >
          <RefreshCw size={18} />
          Atualizar
        </button>
      </div>

      {!isAdmin() && (
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-yellow-500 text-sm">
          Apenas administradores podem alterar configurações críticas.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <MetricCard title="Membros" value={members.length} icon={Users} />
        <MetricCard
          title="Admins"
          value={members.filter((item) => item.role === "admin").length}
          icon={Crown}
        />
        <MetricCard
          title="Ativos"
          value={members.filter((item) => item.is_active !== false).length}
          icon={Shield}
        />
        <MetricCard
          title="Ações registradas"
          value={auditLogs.length}
          icon={History}
        />
      </div>

      {bestSeller && (
        <div className="bg-zinc-950 border border-yellow-500/20 rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
              <Trophy size={32} />
            </div>

            <div>
              <p className="text-sm text-zinc-500">Melhor vendedor</p>
              <h2 className="text-2xl font-bold">{bestSeller.name}</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {bestSeller.assigned} leads · {bestSeller.resolved} resolvidos ·{" "}
                {bestSeller.conversion}% conversão
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleCreateMember}
          className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6"
        >
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <UserPlus className="text-yellow-500" size={20} />
            Criar membro
          </h2>

          <p className="text-sm text-zinc-500 mb-5">
            Cadastre membro no CRM. O login Auth ainda deve ser criado no Supabase.
          </p>

          <div className="space-y-4">
            <Input
              label="Nome"
              value={newMember.name}
              onChange={(e) =>
                setNewMember((old) => ({ ...old, name: e.target.value }))
              }
              placeholder="Ex: Anny"
            />

            <Input
              label="Email"
              value={newMember.email}
              onChange={(e) =>
                setNewMember((old) => ({ ...old, email: e.target.value }))
              }
              placeholder="Ex: anny@email.com"
            />

            <Input
              label="Senha desejada"
              value={newMember.password}
              onChange={(e) =>
                setNewMember((old) => ({ ...old, password: e.target.value }))
              }
              placeholder="Use esta senha ao criar no Supabase Auth"
              type="password"
            />

            <Select
              label="Cargo"
              value={newMember.role}
              onChange={(e) =>
                setNewMember((old) => ({ ...old, role: e.target.value }))
              }
              options={roleOptions}
            />
          </div>

          <button
            disabled={!isAdmin()}
            className="mt-6 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl disabled:opacity-40"
          >
            Criar membro
          </button>
        </form>

        <div className="xl:col-span-2 bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
          <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
            <Activity className="text-yellow-500" size={20} />
            Performance da equipe
          </h2>

          <div className="space-y-4">
            {performance.map((item) => (
              <div
                key={item.id}
                className="bg-black border border-zinc-900 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-bold">
                      {getInitials(item.name)}
                    </div>

                    <div>
                      <p className="font-bold">{item.name}</p>
                      <p className="text-xs text-zinc-500">
                        {getRoleLabel(item.role)} · Último acesso:{" "}
                        {formatDate(item.last_seen_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm">
                    <Badge label="Leads" value={item.assigned} />
                    <Badge label="Resolvidos" value={item.resolved} />
                    <Badge label="Conversão" value={`${item.conversion}%`} />
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <select
                    disabled={!isAdmin()}
                    value={item.role || "seller"}
                    onChange={(e) =>
                      updateMember(
                        item.id,
                        {
                          role: e.target.value,
                          permissions: buildDefaultPermissionsByRole(e.target.value),
                        },
                        `${item.name} teve cargo alterado para ${getRoleLabel(
                          e.target.value
                        )}`
                      )
                    }
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-40"
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={!isAdmin()}
                    onClick={() =>
                      updateMember(
                        item.id,
                        { is_active: item.is_active === false ? true : false },
                        item.is_active === false
                          ? `${item.name} foi reativado`
                          : `${item.name} foi desativado`
                      )
                    }
                    className={`px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-40 ${
                      item.is_active === false
                        ? "bg-emerald-500 text-black"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {item.is_active === false ? "Ativar" : "Desativar"}
                  </button>

                  <button
                    disabled={!isAdmin()}
                    onClick={() =>
                      updateMember(
                        item.id,
                        {
                          permissions: buildDefaultPermissionsByRole(item.role),
                        },
                        `Permissões de ${item.name} foram redefinidas`
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm disabled:opacity-40"
                  >
                    Redefinir permissões
                  </button>
                </div>
              </div>
            ))}

            {!performance.length && (
              <p className="text-zinc-500 text-sm">Nenhum membro cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6">
        <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
          <History className="text-yellow-500" size={20} />
          Histórico de auditoria
        </h2>

        <div className="space-y-3">
          {loading ? (
            <p className="text-zinc-500">Carregando...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-zinc-500">Nenhum histórico registrado.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 border-b border-zinc-900 pb-3"
              >
                <div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                  <Clock size={16} />
                </div>

                <div>
                  <p className="font-semibold">{log.action}</p>
                  <p className="text-sm text-zinc-500">{log.details}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatDate(log.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-sm">{title}</p>
          <h2 className="text-3xl font-bold mt-1">{value}</h2>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function Badge({ label, value }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-center">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
