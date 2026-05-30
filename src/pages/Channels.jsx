import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wifi,
  WifiOff,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  X,
  Trash2,
  Activity,
  Copy,
  QrCode,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";
import {
  connectInstance,
  getConnectionState,
  getEvolutionConfig,
  getEvolutionWebhookUrl,
  getEvolutionState,
  getQrCodeFromResponse,
  mapEvolutionState,
  setWebhook,
} from "@/services/evolutionApi";

function emptyForm() {
  return {
    name: "",
    phone_number: "",
    instance_name: "",
    base_url: "",
    api_key: "",
    api_token: "",
    webhook_url: getEvolutionWebhookUrl(),
  };
}

function statusLabel(status) {
  if (status === "connected") return "Conectado";
  if (status === "connecting") return "Conectando";
  if (status === "qr_pending") return "Aguardando QR";
  if (status === "error") return "Erro";
  return "Desconectado";
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

export default function Channels() {
  const { isAdmin } = useAuth();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingChannelId, setTestingChannelId] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [qrStatus, setQrStatus] = useState("qr_pending");
  const [qrError, setQrError] = useState("");

  const [form, setForm] = useState(emptyForm());

  const loadChannels = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      alert("Erro ao carregar canais.");
    } else {
      setChannels(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const visibleChannels = channels.filter((channel) => channel.type !== "whatsapp");

  const stats = useMemo(() => {
    const connected = visibleChannels.filter(
      (item) =>
        item.status === "connected" || item.connection_status === "connected"
    ).length;

    const disconnected = visibleChannels.length - connected;

    return {
      total: visibleChannels.length,
      connected,
      disconnected,
    };
  }, [visibleChannels]);

  function openModal() {
    const config = getEvolutionConfig();

    setForm({
      ...emptyForm(),
      instance_name: config.instanceName,
      base_url: config.baseUrl,
      api_key: config.apiKey,
      webhook_url: config.webhookUrl,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function openConfig(channel) {
    setSelectedChannel(channel);
    setForm({
      name: channel.name || "",
      phone_number: channel.phone_number || "",
      instance_name: channel.instance_name || "",
      base_url: channel.base_url || "",
      api_key: channel.api_key || "",
      api_token: channel.api_token || "",
      webhook_url: channel.webhook_url || "",
    });
    setConfigModalOpen(true);
  }

  function closeConfig() {
    setConfigModalOpen(false);
    setSelectedChannel(null);
    setForm(emptyForm());
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
      alert("Digite o nome do canal.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("channels").insert({
      name: form.name,
      type: "evolution",
      phone_number: form.phone_number || null,
      instance_name: form.instance_name || null,
      base_url: form.base_url || null,
      api_key: form.api_key || null,
      api_token: form.api_token || null,
      webhook_url: form.webhook_url || null,
      status: "disconnected",
      connection_status: "disconnected",
      qr_code: null,
      last_connection_at: null,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao salvar canal.");
      return;
    }

    closeModal();
    loadChannels();
  }

  async function handleUpdate(e) {
    e.preventDefault();

    if (!selectedChannel?.id) return;

    if (!form.name.trim()) {
      alert("Digite o nome do canal.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("channels")
      .update({
        name: form.name,
        phone_number: form.phone_number || null,
        instance_name: form.instance_name || null,
        base_url: form.base_url || null,
        api_key: form.api_key || null,
        api_token: form.api_token || null,
        webhook_url: form.webhook_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedChannel.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar canal.");
      return;
    }

    closeConfig();
    loadChannels();
  }

  async function deleteChannel(channel) {
    if (!isAdmin()) {
      alert("Somente administrador pode remover canais.");
      return;
    }

    const confirmDelete = confirm(`Deseja remover o canal ${channel.name}?`);

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("channels")
      .delete()
      .eq("id", channel.id);

    if (error) {
      alert(error.message);
      return;
    }

    loadChannels();
  }

  async function testEvolutionChannel(channel) {
    setTestingChannelId(channel.id);

    try {
      const data = await getConnectionState(channel);
      const crmStatus = mapEvolutionState(getEvolutionState(data));

      const { error } = await supabase
        .from("channels")
        .update({
          status: crmStatus,
          connection_status: crmStatus,
          updated_at: new Date().toISOString(),
          last_connection_at:
            crmStatus === "connected"
              ? new Date().toISOString()
              : channel.last_connection_at || null,
        })
        .eq("id", channel.id);

      if (error) throw error;

      await loadChannels();
      alert(`Evolution API respondeu: ${statusLabel(crmStatus)}.`);
    } catch (error) {
      console.error(error);

      await supabase
        .from("channels")
        .update({
          status: "error",
          connection_status: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", channel.id);

      alert(error.message || "Erro ao testar Evolution API.");
      loadChannels();
    } finally {
      setTestingChannelId(null);
    }
  }

  async function configureWebhook(channel) {
    try {
      const config = getEvolutionConfig(channel);
      await setWebhook(channel, config.webhookUrl);
      await navigator.clipboard.writeText(config.webhookUrl);
      alert("Webhook configurado e copiado.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Erro ao configurar webhook.");
    }
  }

  async function openQrCode(channel) {
    setSelectedChannel(channel);
    setQrModalOpen(true);
    setQrCode(channel.qr_code || "");
    setQrStatus(channel.connection_status || channel.status || "qr_pending");
    setQrError("");
    await generateQrCode(channel);
  }

  function closeQrCode() {
    setQrModalOpen(false);
    setQrCode("");
    setQrStatus("qr_pending");
    setQrError("");
    setSelectedChannel(null);
  }

  const generateQrCode = useCallback(async (channel = selectedChannel) => {
    if (!channel?.id) return;

    setQrLoading(true);
    setQrError("");

    try {
      const data = await connectInstance(channel);
      const nextQrCode = getQrCodeFromResponse(data);

      if (!nextQrCode) {
        setQrCode("");
        setQrError("A Evolution respondeu, mas nao retornou imagem de QR Code.");
        return;
      }

      setQrCode(nextQrCode);
      setQrStatus("qr_pending");

      await supabase
        .from("channels")
        .update({
          qr_code: nextQrCode,
          status: "qr_pending",
          connection_status: "qr_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", channel.id);

      loadChannels();
    } catch (error) {
      console.error(error);
      setQrCode("");
      setQrStatus("error");
      setQrError(error.message || "Erro ao gerar QR Code.");
    } finally {
      setQrLoading(false);
    }
  }, [selectedChannel, loadChannels]);

  const checkQrConnection = useCallback(async () => {
    if (!selectedChannel?.id || !qrModalOpen) return;

    try {
      const data = await getConnectionState(selectedChannel);
      const crmStatus = mapEvolutionState(getEvolutionState(data));

      setQrStatus(crmStatus);
      setQrError("");

      if (crmStatus === "connected") {
        await supabase
          .from("channels")
          .update({
            status: "connected",
            connection_status: "connected",
            last_connection_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", selectedChannel.id);

        loadChannels();
      }
    } catch (error) {
      console.error(error);
      setQrStatus("error");
      setQrError(error.message || "Erro ao consultar status da Evolution API.");
    }
  }, [selectedChannel, qrModalOpen, loadChannels]);

  useEffect(() => {
    if (!qrModalOpen || !selectedChannel?.id) return;

    const statusInterval = setInterval(checkQrConnection, 5000);
    const refreshInterval = setInterval(() => {
      if (qrStatus !== "connected" && !qrError && !qrLoading) {
        generateQrCode(selectedChannel);
      }
    }, 25000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(refreshInterval);
    };
  }, [qrModalOpen, selectedChannel, qrStatus, qrError, qrLoading, checkQrConnection, generateQrCode]);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Canais</h1>
          <p className="text-zinc-500 mt-2">
            Gerencie novos canais de atendimento.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadChannels}
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
            Adicionar canal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-8">
        <MetricCard title="Canais" value={stats.total} icon={Radio} />
        <MetricCard title="Ativos" value={stats.connected} icon={Wifi} />
        <MetricCard
          title="Inativos"
          value={stats.disconnected}
          icon={WifiOff}
        />
        <MetricCard title="RemoÃ§Ã£o" value={isAdmin() ? "Admin" : "Bloq."} icon={Trash2} />
      </div>

      {loading ? (
        <div className="text-zinc-500">Carregando canais...</div>
      ) : (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
              <Radio size={23} />
            </div>

            <div>
              <h2 className="text-2xl font-bold">Novos canais</h2>
              <p className="text-zinc-500 text-sm">
                Cadastre e remova canais conforme a autorizaÃ§Ã£o do usuÃ¡rio.
              </p>
            </div>
          </div>

          {visibleChannels.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 text-center">
              <p className="text-zinc-400 mb-5">
                Nenhum canal cadastrado ainda.
              </p>

              <button
                onClick={openModal}
                className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-3 rounded-xl transition"
              >
                <Plus size={18} />
                Adicionar primeiro canal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {visibleChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  canRemove={isAdmin()}
                  testing={testingChannelId === channel.id}
                  onConfig={() => openConfig(channel)}
                  onTest={() => testEvolutionChannel(channel)}
                  onWebhook={() => configureWebhook(channel)}
                  onQr={() => openQrCode(channel)}
                  onDelete={() => deleteChannel(channel)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {modalOpen && (
        <ChannelModal
          title="Adicionar canal"
          subtitle="Cadastre um novo canal para atendimento."
          form={form}
          saving={saving}
          onChange={handleChange}
          onClose={closeModal}
          onSubmit={handleSave}
          submitLabel="Salvar canal"
        />
      )}

      {configModalOpen && (
        <ChannelModal
          title="Configurar canal"
          subtitle="Ajuste os dados do canal."
          form={form}
          saving={saving}
          onChange={handleChange}
          onClose={closeConfig}
          onSubmit={handleUpdate}
          submitLabel="Salvar configuraÃ§Ãµes"
        />
      )}

      {qrModalOpen && selectedChannel && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">QR Code</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  InstÃ¢ncia: {selectedChannel.instance_name || "NÃ£o configurada"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeQrCode}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-3xl bg-black border border-zinc-800 p-6 text-center">
              {qrStatus === "connected" && (
                <div className="mb-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 font-bold">
                  WhatsApp conectado com sucesso
                </div>
              )}

              {qrError && (
                <div className="mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 p-4 text-sm font-medium">
                  {qrError}
                </div>
              )}

              <div className="w-[340px] max-w-full aspect-square mx-auto bg-white rounded-2xl flex items-center justify-center text-black p-5">
                {qrLoading ? (
                  <div className="text-sm font-bold text-zinc-700">
                    Gerando QR Code...
                  </div>
                ) : qrCode ? (
                  <img
                    src={qrCode}
                    alt="QR Code WhatsApp"
                    className="w-full h-full object-contain image-render-auto"
                  />
                ) : (
                  <QrCode className="text-zinc-500" size={120} />
                )}
              </div>

              <p className="text-sm text-zinc-400 mt-5">
                O QR atualiza automaticamente. Escaneie em poucos segundos em um ambiente com boa iluminação.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => generateQrCode()}
                disabled={qrLoading}
                className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-60"
              >
                {qrLoading ? "Gerando..." : "Gerar novamente"}
              </button>

              <button
                onClick={closeQrCode}
                className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  canRemove,
  testing,
  onConfig,
  onTest,
  onWebhook,
  onQr,
  onDelete,
}) {
  const status = channel.connection_status || channel.status || "disconnected";

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 hover:border-yellow-500/40 transition">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
            <Radio size={26} />
          </div>

          <div>
            <h3 className="text-xl font-bold">{channel.name}</h3>
            <p className="text-zinc-500 text-sm mt-1">
              Canal de atendimento cadastrado.
            </p>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      <div className="space-y-3">
        <Info label="Nome" value={channel?.name || "Sem nome"} />
        <Info label="Tipo" value={channel?.type || "custom"} />
        <Info
          label="Identificador"
          value={channel?.phone_number || channel?.instance_name || "NÃ£o informado"}
        />
        <Info label="Base URL" value={channel?.base_url || "NÃ£o configurada"} />
        <Info label="Webhook" value={channel?.webhook_url || "NÃ£o configurado"} />
        <Info label="Status" value={statusLabel(status)} />
        <Info
          label="Ãšltima atualizaÃ§Ã£o"
          value={formatDate(channel.updated_at || channel.created_at)}
        />
      </div>

      <div className="flex flex-wrap gap-3 mt-6">
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-3 rounded-xl transition disabled:opacity-60"
        >
          <Activity size={17} />
          {testing ? "Testando..." : "Testar API"}
        </button>

        <button
          onClick={onConfig}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
        >
          <Settings size={17} />
          Configurar
        </button>

        <button
          onClick={onQr}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
        >
          <QrCode size={17} />
          QR Code
        </button>

        <button
          onClick={onWebhook}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-3 rounded-xl transition"
        >
          <Copy size={17} />
          Webhook
        </button>

        <button
          onClick={onDelete}
          disabled={!canRemove}
          className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={17} />
          Remover
        </button>
      </div>
    </div>
  );
}

function ChannelModal({
  title,
  subtitle,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 max-h-[65vh] overflow-auto pr-1">
          <Input
            label="Nome do canal"
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="Ex: Canal Vendas"
          />

          <Input
            label="Identificador"
            name="phone_number"
            value={form.phone_number}
            onChange={onChange}
            placeholder="Ex: vendas-principal"
          />

          <Input
            label="Nome da instÃ¢ncia"
            name="instance_name"
            value={form.instance_name}
            onChange={onChange}
            placeholder="Ex: maxrcm-vendas"
          />

          <Input
            label="Base URL"
            name="base_url"
            value={form.base_url}
            onChange={onChange}
            placeholder="Ex: https://api.seudominio.com"
          />

          <Input
            label="API Key"
            name="api_key"
            value={form.api_key}
            onChange={onChange}
            placeholder="Cole a API Key aqui"
          />

          <Input
            label="Token legado / opcional"
            name="api_token"
            value={form.api_token}
            onChange={onChange}
            placeholder="Opcional"
          />

          <Input
            label="Webhook URL"
            name="webhook_url"
            value={form.webhook_url}
            onChange={onChange}
            placeholder="Ex: https://seusite.com/webhook"
          />
        </div>

        <div className="flex justify-end gap-3 mt-7">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold disabled:opacity-60"
          >
            {saving ? "Salvando..." : submitLabel}
          </button>
        </div>
      </form>
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

function StatusBadge({ status }) {
  const classes = {
    connected: "bg-emerald-500/10 text-emerald-400",
    connecting: "bg-yellow-500/10 text-yellow-400",
    qr_pending: "bg-yellow-500/10 text-yellow-400",
    error: "bg-red-500/10 text-red-400",
    disconnected: "bg-zinc-900 text-zinc-500",
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold ${
        classes[status] || classes.disconnected
      }`}
    >
      {status === "connected" ? <Wifi size={14} /> : <WifiOff size={14} />}
      {statusLabel(status)}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-900 pb-3 gap-4">
      <span className="text-zinc-500 text-sm shrink-0">{label}</span>
      <span className="text-sm font-medium text-right truncate">{value}</span>
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

