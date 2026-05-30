import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthContext } from "@/context/useAuth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadMember(currentUser) {
    if (!currentUser?.email) {
      setMember(null);
      return null;
    }

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("email", currentUser.email)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar membro:", error);
      setMember(null);
      return null;
    }

    setMember(data || null);
    return data || null;
  }

  useEffect(() => {
    let active = true;

    async function initAuth() {
      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        const currentUser = session?.user || null;

        setUser(currentUser);

        if (currentUser) {
          await loadMember(currentUser);
        } else {
          setMember(null);
        }
      } catch (error) {
        console.error("Erro no AuthContext:", error);
        setUser(null);
        setMember(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;

      setUser(currentUser);

      if (currentUser) {
        loadMember(currentUser);
      } else {
        setMember(null);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    setLoading(true);

    const result = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (result.data?.user) {
      setUser(result.data.user);
      await loadMember(result.data.user);
    }

    setLoading(false);

    return result;
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setMember(null);
    setLoading(false);
  }

  async function updateProfileAvatar(avatarUrl) {
    if (!member?.id) {
      return { error: new Error("Usuário sem membro de equipe vinculado.") };
    }

    const { data, error } = await supabase
      .from("team_members")
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id)
      .select("*")
      .single();

    if (!error) {
      setMember(data);
    }

    return { data, error };
  }

  function isAdmin() {
    return member?.role === "admin";
  }

  function isSupervisor() {
    return member?.role === "supervisor";
  }

  function isSeller() {
    return member?.role === "seller";
  }

  function canAccess(path) {
    if (!member) return true;

    if (member.role === "admin") return true;

    if (member.role === "supervisor") {
      return ["/", "/conversations", "/funnel", "/customers", "/team"].includes(
        path
      );
    }

    if (member.role === "seller") {
      return ["/conversations", "/funnel"].includes(path);
    }

    return true;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        loading,
        login,
        logout,
        updateProfileAvatar,
        isAdmin,
        isSupervisor,
        isSeller,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
