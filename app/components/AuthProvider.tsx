"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import type { Role } from "../lib/types";
import type { UserProfile } from "../lib/users";
import { fetchUserProfile } from "../lib/users";

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  isActive: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(nextUser);
      const nextProfile = await fetchUserProfile(nextUser.uid);
      if (!active) return;

      setProfile(nextProfile);
      setLoading(false);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const role = profile?.role ?? null;
    const isActive = profile?.isActive ?? false;
    return { user, profile, role, isActive, loading };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
