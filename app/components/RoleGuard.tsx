"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import type { Role } from "../lib/types";

export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, role, isActive, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!profile) {
      router.replace("/login");
      return;
    }

    if (!isActive) {
      router.replace("/login");
      return;
    }

    if (!role) {
      router.replace("/login");
      return;
    }

    if (!allowed.includes(role)) {
      router.replace(role === "admin" ? "/dashboard" : "/pos");
      return;
    }
  }, [allowed, isActive, loading, profile, role, router, user]);

  const isAllowed = !!user && !!profile && isActive && !!role && allowed.includes(role);

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>;
  if (!isAllowed) return <div style={{ padding: 20 }}>Redirigiendo...</div>;

  return <>{children}</>;
}
