import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "tenant" | "landlord" | "admin";

export type SessionState = {
  loading: boolean;
  user: User | null;
  role: AppRole | null;
  fullName: string;
  trust: number;
};

export function roleHome(role: AppRole | null): "/app/tenant" | "/app/landlord" | "/app/admin" {
  if (role === "landlord") return "/app/landlord";
  if (role === "admin") return "/app/admin";
  return "/app/tenant";
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
    role: null,
    fullName: "",
    trust: 50,
  });

  useEffect(() => {
    let alive = true;

    async function load(user: User | null) {
      if (!user) {
        if (alive) setState({ loading: false, user: null, role: null, fullName: "", trust: 50 });
        return;
      }
      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name, trust_score").eq("id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      setState({
        loading: false,
        user,
        role: (roleRow?.role as AppRole | undefined) ?? "tenant",
        fullName: profile?.full_name || user.email || "Account",
        trust: profile?.trust_score ?? 50,
      });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load(session?.user ?? null);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
