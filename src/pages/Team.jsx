import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  UserCog,
  Users,
  Mail,
  Shield,
  Circle,
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Bell,
  Crown,
  Save,
  AlertTriangle,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";

const statusOptions = [
  { value: "online", label: "Online" },
  { value: "busy", label: "Atendendo" },
  { value: "away", label: "Ausente" },
  { value: "offline", label: "Offline" },
];

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "seller", label: "Vendedor" },
];

const notificationPriorityOptions = [
  { value: "normal", label: "Comum" },
  { value: "priority", label: "Prioridade" },
  { value: "urgent", label: "Urgente" },
];

const defaultPermissions = {
  can_view_all: false,
  can_transfer: true,
  can_manage_team: false,
  can_manage_channels: false,
  can_send_notifications: false,
  can_change_roles: false,
};

export default function Team() {
  const { member: loggedMember, isAdmin } = useAuth();

  const [members, setMembers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "seller",
    status: "offline",
  });

  const [permissionForm, setPermissionForm] = useState({
    role: "seller",
    is_active: true,
    permissions: defaultPermissions,
  });

  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    priority: "normal",
  });

  async function loadData() {
    setLoading(true);

    const { data: membersData, error: membersError } = await supabase
      .from("team_members")
      .select("*")
      .order("name", { ascending: true });

    const { data: conversationsData, error: conversationsError } =
      await supabase
        .from("conversations")
        .select("id, assigned_to, status, funnel_stage, tag");

    if (membersError) {
      console.error(membersError);
      alert("Erro ao carregar equipe.");
    } else {
      setMembers(membersData || []);
    }

    if (conversationsError) {
      console.error(conversationsError);
    } else {
      setConversations(conversationsData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function openModal() {
    setForm({
      name: "",
      email: "",
      role: "seller",
      status: "offline",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  }

  async function handleSave(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Digite o nome do membro.");
      return;
    }

    if (!form.email.trim()) {
      alert("Digite o email do membro.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("team_members").insert({
      name: form.name,
      email: form.email,
      role: form.role,
      status: form.status,
      is_active: true,
      permissions: buildDefaultPermissionsByRole(form.role),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao salvar membro da equipe.");
      return;
    }

    closeModal();
    loadData();
  }

  function openPermissions(member) {
    if (!isAdmin()) {
      alert("Somente Admin pode alterar permissões e cargos.");
      return;
    }

    setSelectedMember(member);
    setPermissionForm({
      role: member.role || "seller",
      is_active: member.is_active === false ? false : true,
      permissions: {
        ...buildDefaultPermissionsByRole(member.role),
        ...(member.permissions || {}),
      },
    });
    setPermissionsModalOpen(true);
  }

  function closePermissions() {
    setPermissionsModalOpen(false);
    setSelectedMember(null);
  }

  function handlePermissionToggle(key) {
    setPermissionForm((old) => ({
      ...old,
      permissions: {
        ...old.permissions,
        [key]: !old.permissions[key],
      },
    }));
  }

  async function savePermissions(e) {
    e.preventDefault();

    if (!selectedMember?.id) return;

    if (!isAdmin()) {
      alert("Somente Admin pode alterar permissões.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("team_members")
      .update({
        role: permissionForm.role,
        is_active: permissionForm.is_active,
        permissions: permissionForm.permissions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedMember.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao salvar permissões.");
      return;
    }

    closePermissions();
    loadData();
  }

  function openNotify(member) {
    if (!isAdmin()) {
      alert("Somente Admin pode notificar a equipe por enquanto.");
      return;
    }

    setSelectedMember(member);
    setNotificationForm({
      title: "",
      message: "",
      priority: "normal",
    });
    setNotifyModalOpen(true);
  }

  function closeNotify() {
    setNotifyModalOpen(false);
    setSelectedMember(null);
  }

  async function sendNotification(e) {
    e.preventDefault();

    if (!selectedMember?.id) return;

    if (!notificationForm.title.trim()) {
      alert("Digite o título da notificação.");
      return;
    }

    if (!notificationForm.message.trim()) {
      alert("Digite a mensagem da notificação.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("notifications").insert({
      member_id: selectedMember.id,
      sender_id: loggedMember?.id || null,
      title: notificationForm.title,
      message: notificationForm.message,
      priority: notificationForm.priority,
      read: false,
      created_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao enviar notificação.");
      return;
    }

    closeNotify();
    alert("Notificação enviada com sucesso.");
  }

  async function deleteMember(member) {
    if (!isAdmin()) {
      alert("Somente Admin pode excluir vendedores.");
      return;
    }

    if (member.id === loggedMember?.id) {
      alert("Você não pode excluir o próprio usuário logado.");
      return;
    }

    const confirmDelete = confirm(`Deseja excluir ${member.name} da equipe?`);

    if (!confirmDelete) return;

    setSaving(true);

    await supabase
      .from("conversations")
      .update({ assigned_to: null })
      .eq("assigned_to", member.id);

    await supabase
      .from("notifications")
      .delete()
      .eq("member_id", member.id);

    await supabase
      .from("notifications")
      .delete()
      .eq("sender_id", member.id);

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", member.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao excluir vendedor.");
      return;
    }

    loadData();
  }

  const stats = useMemo(() => {
    const totalOnline = members.filter((item) => item.status === "online").length;
    const totalBusy = members.filter((item) => item.status === "busy").length;
    const totalSellers = members.filter((item) => item.role === "seller").length;
    const totalAdmins = members.filter((item) => item.role === "admin").length;
    const unassigned = conversations.filter((item) => !item.assigned_to).length;

    return {
      totalOnline,
      totalBusy,
      totalSellers,
      totalAdmins,
      unassigned,
    };
  }, [members, conversations]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Equipe</h1>
          <p className="text-zinc-500 mt-2">
            Controle vendedores, permissões, cargos e notificações internas.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>

          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-3 rounded-xl transition"
          >
            <Plus size={18} />
            Adicionar membro
          </button>
        </div>
      </div>

      {!isAdmin() && (
        <div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-500 flex items-center gap-3">
          <AlertTriangle size={18} />
          Apenas administradores podem alterar permissões, cargos e enviar notificações.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-5 mb-8">
        <MetricCard title="Membros" value={members.length} icon={Users} />
        <MetricCard title="Admins" value={stats.totalAdmins} icon={Crown} />
        <MetricCard title="Online" value={stats.totalOnline} icon={Circle} />
        <MetricCard title="Atendendo" value={stats.totalBusy} icon={UserCog} />
        <MetricCard title="Vendedores" value={stats.totalSellers} icon={Shield} />
        <MetricCard
          title="Sem responsável"
          value={stats.unassigned}
          icon={AlertCircle}
        />
      </div>

      {loading ? (
        <div className="text-zinc-500">Carregando equipe...</div>
      ) : members.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
          <p className="text-zinc-400 mb-5">Nenhum membro cadastrado ainda.</p>

          <button
            onClick={openModal}
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-3 rounded-xl transition"
          >
            <Plus size={18} />
            Adicionar primeiro membro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              conversations={conversations}
              canManage={isAdmin()}
              onPermissions={() => openPermissions(member)}
              onNotify={() => openNotify(member)}
              onDelete={() => deleteMember(member)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <form
            onSubmit={handleSave}
            className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Adicionar membro</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Cadastre um vendedor, supervisor ou admin.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="Nome"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ex: Anny"
              />

              <Input
                label="Email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Ex: anny@email.com"
              />

              <Select
                label="Cargo"
                name="role"
                value={form.role}
                onChange={handleChange}
                options={roleOptions}
              />

              <Select
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                options={statusOptions}
              />
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar membro"}
              </button>
            </div>
          </form>
        </div>
      )}

      {permissionsModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <form
            onSubmit={savePermissions}
            className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Permissões</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Alterar cargo e permissões de {selectedMember.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={closePermissions}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Cargo</label>
                <select
                  value={permissionForm.role}
                  onChange={(e) =>
                    setPermissionForm((old) => ({
                      ...old,
                      role: e.target.value,
                      permissions: {
                        ...old.permissions,
                        ...buildDefaultPermissionsByRole(e.target.value),
                      },
                    }))
                  }
                  className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
                >
                  {roleOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Status do usuário</label>
                <select
                  value={permissionForm.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    setPermissionForm((old) => ({
                      ...old,
                      is_active: e.target.value === "active",
                    }))
                  }
                  className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Desativado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PermissionToggle
                title="Ver todos os atendimentos"
                description="Permite enxergar conversas de toda a equipe."
                checked={permissionForm.permissions.can_view_all}
                onChange={() => handlePermissionToggle("can_view_all")}
              />

              <PermissionToggle
                title="Transferir atendimentos"
                description="Permite enviar conversa para outro vendedor."
                checked={permissionForm.permissions.can_transfer}
                onChange={() => handlePermissionToggle("can_transfer")}
              />

              <PermissionToggle
                title="Gerenciar equipe"
                description="Permite acessar controles da equipe."
                checked={permissionForm.permissions.can_manage_team}
                onChange={() => handlePermissionToggle("can_manage_team")}
              />

              <PermissionToggle
                title="Gerenciar canais"
                description="Permite configurar WhatsApps e canais."
                checked={permissionForm.permissions.can_manage_channels}
                onChange={() => handlePermissionToggle("can_manage_channels")}
              />

              <PermissionToggle
                title="Enviar notificações"
                description="Permite notificar vendedores pelo painel."
                checked={permissionForm.permissions.can_send_notifications}
                onChange={() => handlePermissionToggle("can_send_notifications")}
              />

              <PermissionToggle
                title="Alterar cargos"
                description="Permite promover e rebaixar usuários."
                checked={permissionForm.permissions.can_change_roles}
                onChange={() => handlePermissionToggle("can_change_roles")}
              />
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                type="button"
                onClick={closePermissions}
                className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-60 flex items-center gap-2"
              >
                <Save size={17} />
                {saving ? "Salvando..." : "Salvar permissões"}
              </button>
            </div>
          </form>
        </div>
      )}

      {notifyModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <form
            onSubmit={sendNotification}
            className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Notificar vendedor</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  Enviar alerta para {selectedMember.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeNotify}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="Título"
                name="title"
                value={notificationForm.title}
                onChange={(e) =>
                  setNotificationForm((old) => ({
                    ...old,
                    title: e.target.value,
                  }))
                }
                placeholder="Ex: Cliente VIP aguardando retorno"
              />

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Mensagem</label>
                <textarea
                  value={notificationForm.message}
                  onChange={(e) =>
                    setNotificationForm((old) => ({
                      ...old,
                      message: e.target.value,
                    }))
                  }
                  placeholder="Digite a mensagem para o vendedor..."
                  className="w-full min-h-32 bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white resize-none"
                />
              </div>

              <Select
                label="Prioridade"
                name="priority"
                value={notificationForm.priority}
                onChange={(e) =>
                  setNotificationForm((old) => ({
                    ...old,
                    priority: e.target.value,
                  }))
                }
                options={notificationPriorityOptions}
              />

              {notificationForm.priority === "urgent" && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm flex items-center gap-3">
                  <AlertTriangle size={18} />
                  Essa notificação será tratada como urgente no painel do vendedor.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button
                type="button"
                onClick={closeNotify}
                className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-60 flex items-center gap-2"
              >
                <Bell size={17} />
                {saving ? "Enviando..." : "Enviar notificação"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon }) {
  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-5 hover:border-yellow-500/30 transition">
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

function MemberCard({
  member,
  conversations,
  canManage,
  onPermissions,
  onNotify,
  onDelete,
}) {
  const memberConversations = conversations.filter(
    (item) => item.assigned_to === member.id
  );

  const openConversations = memberConversations.filter(
    (item) => item.status !== "resolved" && item.status !== "closed"
  );

  const resolvedConversations = memberConversations.filter(
    (item) => item.status === "resolved" || item.status === "closed"
  );

  return (
    <div
      className={`bg-zinc-950 border rounded-3xl p-6 hover:border-yellow-500/40 transition ${
        member.is_active === false ? "border-red-500/20 opacity-70" : "border-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
              {member.role === "admin" ? <Crown size={30} /> : <UserCog size={30} />}
            </div>

            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-950 ${getStatusDotClass(
                member.status
              )}`}
            />
          </div>

          <div>
            <h3 className="text-xl font-bold">{member.name}</h3>
            <p className="text-zinc-500 text-sm mt-1">
              {getRoleLabel(member.role)}
            </p>
            <StatusBadge status={member.status} />
          </div>
        </div>

        {member.is_active === false && (
          <span className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded-full">
            Desativado
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <MiniMetric
          label="Total"
          value={memberConversations.length}
          icon={MessageSquare}
        />
        <MiniMetric
          label="Abertas"
          value={openConversations.length}
          icon={UserCheck}
        />
        <MiniMetric
          label="Resolvidas"
          value={resolvedConversations.length}
          icon={CheckCircle2}
        />
      </div>

      <div className="space-y-3">
        <Info label="Nome" value={member.name || "Sem nome"} />
        <Info label="Email" value={member.email || "Não informado"} />
        <Info label="Cargo" value={getRoleLabel(member.role)} />
        <Info label="Status" value={getStatusLabel(member.status)} />
        <Info
          label="Ativo"
          value={member.is_active === false ? "Não" : "Sim"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3">
        <button className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition">
          <Mail size={17} />
          Login
        </button>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={onPermissions}
            disabled={!canManage}
            className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Shield size={17} />
            Permissões
          </button>

          <button
            onClick={onNotify}
            disabled={!canManage}
            className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Bell size={17} />
            Notificar
          </button>

          <button
            onClick={onDelete}
            disabled={!canManage}
            className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={17} />
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }) {
  return (
    <div className="bg-black border border-zinc-900 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <Icon size={15} className="text-yellow-500" />
        <span className="text-lg font-bold">{value}</span>
      </div>

      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function PermissionToggle({ title, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`text-left rounded-2xl border p-4 transition ${
        checked
          ? "border-yellow-500/50 bg-yellow-500/10"
          : "border-zinc-800 bg-black hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        </div>

        <div
          className={`w-11 h-6 rounded-full p-1 transition ${
            checked ? "bg-yellow-500" : "bg-zinc-800"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </div>
    </button>
  );
}

function StatusBadge({ status }) {
  const label = getStatusLabel(status);

  const classes = {
    online: "bg-emerald-500/10 text-emerald-400",
    busy: "bg-yellow-500/10 text-yellow-400",
    away: "bg-orange-500/10 text-orange-400",
    offline: "bg-zinc-900 text-zinc-500",
  };

  return (
    <div
      className={`mt-2 inline-flex px-3 py-1 rounded-full text-xs font-bold ${
        classes[status] || classes.offline
      }`}
    >
      {label}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function Input({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      <input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-black border border-zinc-800 focus:border-yellow-500 outline-none rounded-xl px-4 py-3 text-white"
      />
    </div>
  );
}

function Select({ label, name, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-2">{label}</label>
      <select
        name={name}
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

function getRoleLabel(role) {
  const roles = {
    admin: "Admin",
    supervisor: "Supervisor",
    seller: "Vendedor",
  };

  return roles[role] || "Vendedor";
}

function getStatusLabel(status) {
  const statuses = {
    online: "Online",
    busy: "Atendendo",
    away: "Ausente",
    offline: "Offline",
  };

  return statuses[status] || "Offline";
}

function getStatusDotClass(status) {
  const classes = {
    online: "bg-emerald-400",
    busy: "bg-yellow-400",
    away: "bg-orange-400",
    offline: "bg-zinc-600",
  };

  return classes[status] || classes.offline;
}
