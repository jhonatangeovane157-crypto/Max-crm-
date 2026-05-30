import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Crown,
  LayoutDashboard,
  MessageSquare,
  Users,
  UserCog,
  Radio,
  Settings,
  LogOut,
  GitBranch,
  Bell,
  AlertTriangle,
  Camera,
  X,
} from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/lib/supabase";

const menu = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Conversas", path: "/conversations", icon: MessageSquare },
  { label: "Funil", path: "/funnel", icon: GitBranch },
  { label: "Clientes", path: "/customers", icon: Users },
  { label: "Equipe", path: "/team", icon: UserCog },
  { label: "Canais", path: "/channels", icon: Radio },
  { label: "Configurações", path: "/settings", icon: Settings },
];

function getRoleLabel(role) {
  const roles = {
    admin: "Admin",
    supervisor: "Supervisor",
    seller: "Vendedor",
  };

  return roles[role] || "Sem cargo definido";
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

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 512;
        const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let urgentAudioInterval = null;
const activeUrgentAudioContexts = new Set();

function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.22, audioContext.currentTime);

    oscillator.start();

    setTimeout(() => {
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime);
    }, 180);

    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 700);
  } catch {
    console.log("Som bloqueado pelo navegador.");
  }
}

function playUrgentAlarm() {
  stopUrgentAlarm();

  function playUrgentBurst() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      activeUrgentAudioContexts.add(audioContext);

      const masterGain = audioContext.createGain();
      const siren = audioContext.createOscillator();
      const pierce = audioContext.createOscillator();

      siren.connect(masterGain);
      pierce.connect(masterGain);
      masterGain.connect(audioContext.destination);

      const now = audioContext.currentTime;

      siren.type = "square";
      pierce.type = "sawtooth";

      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.95, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

      siren.frequency.setValueAtTime(1850, now);
      siren.frequency.setValueAtTime(760, now + 0.08);
      siren.frequency.setValueAtTime(2100, now + 0.16);
      siren.frequency.setValueAtTime(900, now + 0.24);
      siren.frequency.setValueAtTime(2300, now + 0.32);

      pierce.frequency.setValueAtTime(2600, now);
      pierce.frequency.setValueAtTime(3100, now + 0.11);
      pierce.frequency.setValueAtTime(2400, now + 0.22);
      pierce.frequency.setValueAtTime(3300, now + 0.33);

      siren.start(now);
      pierce.start(now);
      siren.stop(now + 0.44);
      pierce.stop(now + 0.44);

      setTimeout(() => {
        audioContext.close();
        activeUrgentAudioContexts.delete(audioContext);
      }, 520);
    } catch {
      console.log("Som bloqueado pelo navegador.");
    }
  }

  playUrgentBurst();
  urgentAudioInterval = setInterval(playUrgentBurst, 540);
}

function stopUrgentAlarm() {
  if (urgentAudioInterval) {
    clearInterval(urgentAudioInterval);
    urgentAudioInterval = null;
  }

  activeUrgentAudioContexts.forEach((audioContext) => {
    audioContext.close().catch(() => {});
  });
  activeUrgentAudioContexts.clear();
}

export default function DashboardLayout() {
  const location = useLocation();
  const { user, member, logout, canAccess, updateProfileAvatar } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarInputRef = useRef(null);

  const memberId = member?.id;
  const visibleMenu = menu.filter((item) => canAccess(item.path));
  const unreadCount = notifications.filter((item) => !item.read).length;

  const loadNotifications = useCallback(async () => {
    if (!memberId) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("member_id", memberId)
      .eq("read", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setNotifications(data || []);

    if (data?.length) {
      setActiveNotification(data[0]);

      if (data[0].priority === "urgent") {
        playUrgentAlarm();
      } else if (data[0].priority === "priority") {
        playAlertSound();
      }
    }
  }, [memberId]);

  async function markAsRead(notificationId) {
    stopUrgentAlarm();

    if (!notificationId) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);

    setNotifications((current) =>
      current.filter((item) => item.id !== notificationId)
    );

    setActiveNotification(null);
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione uma imagem válida.");
      return;
    }

    try {
      setAvatarSaving(true);
      const avatarUrl = await resizeAvatar(file);
      const { error } = await updateProfileAvatar(avatarUrl);

      if (error) {
        alert(error.message);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar foto de perfil.");
    } finally {
      setAvatarSaving(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!memberId) return;

    const interval = setInterval(() => {
      loadNotifications();
    }, 3000);

    return () => clearInterval(interval);
  }, [memberId, loadNotifications]);

  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel(`notifications-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `member_id=eq.${memberId}`,
        },
        (payload) => {
          const notification = payload.new;

          setNotifications((current) => [notification, ...current]);
          setActiveNotification(notification);

          if (notification.priority === "urgent") {
            playUrgentAlarm();
          } else if (notification.priority === "priority") {
            playAlertSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  useEffect(() => {
    return () => stopUrgentAlarm();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-72 bg-[#070707] border-r border-zinc-900 flex flex-col">
        <div className="p-6 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl glass-card-gold flex items-center justify-center">
              <Crown className="text-yellow-500" />
            </div>

            <div>
              <h1 className="font-bold text-lg">
                MAX <span className="gold-text">RCM</span>
              </h1>
              <p className="text-xs text-zinc-500">Multiatendimento IA</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? "glass-card-gold text-yellow-500"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-900">
          <button
            onClick={loadNotifications}
            className="w-full mb-3 flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition"
          >
            <span className="flex items-center gap-2 text-sm">
              <Bell size={17} className="text-yellow-500" />
              Notificações
            </span>

            <span className="bg-yellow-500 text-black text-xs font-bold rounded-full px-2 py-1">
              {unreadCount}
            </span>
          </button>

          <div className="glass-card-gold rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-xs font-bold overflow-hidden">
                  {member?.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member?.name || user?.email || "Perfil"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(member?.name || user?.email)
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarSaving}
                  className="absolute -right-2 -bottom-2 w-7 h-7 rounded-lg bg-yellow-500 text-black flex items-center justify-center hover:bg-yellow-400 transition disabled:opacity-60"
                  title="Trocar foto de perfil"
                >
                  <Camera size={14} />
                </button>
              </div>

              <div className="min-w-0">
                <p className="text-xs text-zinc-500">Logado como</p>
                <p className="text-sm font-semibold truncate">{user?.email}</p>
              </div>
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />

            <div className="mt-3 inline-flex px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-bold">
              {avatarSaving ? "Salvando foto..." : getRoleLabel(member?.role)}
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {activeNotification && activeNotification.priority !== "urgent" && (
        <div className="fixed right-6 bottom-6 z-50 w-[360px] bg-zinc-950 border border-yellow-500/30 rounded-3xl p-5 shadow-2xl shadow-black">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                {activeNotification.priority === "priority" ? (
                  <AlertTriangle className="text-yellow-500" />
                ) : (
                  <Bell className="text-yellow-500" />
                )}
              </div>

              <div>
                <h3 className="font-bold">{activeNotification.title}</h3>
                <p className="text-xs text-zinc-500">
                  {activeNotification.priority === "priority"
                    ? "Prioridade"
                    : "Notificação"}
                </p>
              </div>
            </div>

            <button
              onClick={() => markAsRead(activeNotification.id)}
              className="w-8 h-8 rounded-xl bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
            >
              <X size={15} />
            </button>
          </div>

          <p className="text-sm text-zinc-300 mt-4 leading-relaxed">
            {activeNotification.message}
          </p>

          <button
            onClick={() => markAsRead(activeNotification.id)}
            className="mt-5 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl"
          >
            Entendi
          </button>
        </div>
      )}

      {activeNotification && activeNotification.priority === "urgent" && (
        <div className="fixed inset-0 z-[999] bg-red-950/95 flex items-center justify-center animate-pulse">
          <div className="w-full max-w-xl bg-black border-2 border-red-500 rounded-3xl p-8 text-center shadow-2xl shadow-red-900">
            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-5">
              <AlertTriangle className="text-red-400" size={44} />
            </div>

            <h1 className="text-4xl font-black text-red-400 mb-3">
              URGENTE
            </h1>

            <h2 className="text-2xl font-bold mb-4">
              {activeNotification.title}
            </h2>

            <p className="text-zinc-300 leading-relaxed text-lg">
              {activeNotification.message}
            </p>

            <button
              onClick={() => markAsRead(activeNotification.id)}
              className="mt-8 w-full bg-red-500 hover:bg-red-400 text-white font-black py-4 rounded-xl text-lg"
            >
              ENTENDI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
