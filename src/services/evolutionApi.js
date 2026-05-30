const DEFAULT_EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || "";
const DEFAULT_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || "";
const DEFAULT_INSTANCE_NAME = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || "";
const API_PREFIX = import.meta.env.VITE_EVOLUTION_API_PREFIX || "";
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL || "";
const DEFAULT_WEBHOOK_PATH =
  import.meta.env.VITE_EVOLUTION_WEBHOOK_PATH || "/webhooks/evolution";
const DEFAULT_WEBHOOK_URL = import.meta.env.VITE_EVOLUTION_WEBHOOK_URL || "";

export function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function normalizePath(path) {
  return `/${String(path || "").replace(/^\/+/, "")}`;
}

function getApiPath(path) {
  return `${normalizePath(API_PREFIX)}${normalizePath(path)}`.replace(/^\/\//, "/");
}

export function cleanPhoneNumber(phone) {
  const cleaned = String(phone || "").replace(/\D/g, "");

  if (!cleaned) return "";

  return cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
}

export function normalizeQrImage(value) {
  if (!value) return "";
  if (value.startsWith("data:image")) return value;
  return `data:image/png;base64,${value}`;
}

export function getQrCodeFromResponse(data) {
  return normalizeQrImage(
    data?.base64 ||
      data?.qrcode ||
      data?.qr ||
      data?.code ||
      data?.pairingCode ||
      data?.data?.base64 ||
      data?.data?.qrcode ||
      data?.data?.qr ||
      ""
  );
}

export function getEvolutionWebhookUrl() {
  if (DEFAULT_WEBHOOK_URL) return DEFAULT_WEBHOOK_URL;
  if (!PUBLIC_APP_URL) return "";

  return `${normalizeBaseUrl(PUBLIC_APP_URL)}${normalizePath(DEFAULT_WEBHOOK_PATH)}`;
}

export function getEvolutionConfig(channel = {}) {
  return {
    baseUrl: normalizeBaseUrl(channel.base_url || DEFAULT_EVOLUTION_URL),
    apiKey: channel.api_key || channel.api_token || DEFAULT_API_KEY,
    instanceName: channel.instance_name || DEFAULT_INSTANCE_NAME,
    webhookUrl: channel.webhook_url || getEvolutionWebhookUrl(),
  };
}

export function hasEvolutionConfig(channel = {}) {
  const { baseUrl, apiKey, instanceName } = getEvolutionConfig(channel);

  return Boolean(baseUrl && apiKey && instanceName);
}

export async function evolutionRequest(channel, path, method = "GET", body = null) {
  const { baseUrl, apiKey } = getEvolutionConfig(channel);

  if (!baseUrl) {
    throw new Error("Base URL da Evolution API não configurada.");
  }

  if (!apiKey) {
    throw new Error("API Key da Evolution API não configurada.");
  }

  const response = await fetch(`${baseUrl}${getApiPath(path)}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: body ? JSON.stringify(body) : null,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Evolution API erro ${response.status}: ${text}`);
  }

  return response.json();
}

export function getEvolutionState(data) {
  return (
    data?.instance?.state ||
    data?.state ||
    data?.connectionState ||
    data?.status ||
    "close"
  );
}

export function mapEvolutionState(state) {
  if (state === "open") return "connected";
  if (state === "connecting") return "connecting";
  if (state === "close") return "disconnected";
  return state || "disconnected";
}

export async function connectInstance(channel = {}) {
  const { instanceName } = getEvolutionConfig(channel);

  if (!instanceName) {
    throw new Error("Nome da instância da Evolution não configurado.");
  }

  return evolutionRequest(channel, `/instance/connect/${instanceName}`);
}

export async function getConnectionState(channel = {}) {
  const { instanceName } = getEvolutionConfig(channel);

  if (!instanceName) {
    throw new Error("Nome da instância da Evolution não configurado.");
  }

  return evolutionRequest(channel, `/instance/connectionState/${instanceName}`);
}

export async function setWebhook(channel = {}, webhookUrl = null) {
  const { instanceName, webhookUrl: configuredWebhookUrl } =
    getEvolutionConfig(channel);
  const targetWebhookUrl = webhookUrl || configuredWebhookUrl;

  if (!instanceName) {
    throw new Error("Nome da instância da Evolution não configurado.");
  }

  if (!targetWebhookUrl) {
    throw new Error("URL de webhook não configurada.");
  }

  return evolutionRequest(channel, `/webhook/set/${instanceName}`, "POST", {
    webhook: {
      enabled: true,
      url: targetWebhookUrl,
      webhookByEvents: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    },
  });
}

export async function sendText({ channel = {}, number, text }) {
  const { instanceName } = getEvolutionConfig(channel);
  const formattedNumber = cleanPhoneNumber(number);

  if (!instanceName) {
    throw new Error("Nome da instância da Evolution não configurado.");
  }

  if (!formattedNumber) {
    throw new Error("Número do cliente não informado.");
  }

  return evolutionRequest(channel, `/message/sendText/${instanceName}`, "POST", {
    number: formattedNumber,
    text,
  });
}
