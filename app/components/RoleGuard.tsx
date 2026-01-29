"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; // ajusta ruta si tu firebase.ts está en otro lado

type Role = "admin" | "cashier";

export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      // leemos el usuario desde Firestore: users/{uid}
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        router.replace("/login");
        return;
      }

      const userData = snap.data();

      // ✅ normalizamos isActive por seguridad (puede venir boolean o string)
      const isActive =
        userData?.isActive === true || userData?.isActive === "true";

      if (!isActive) {
        router.replace("/login");
        return;
      }

      const role = (userData?.role || "") as Role;

      if (!allowed.includes(role)) {
        router.replace(role === "admin" ? "/dashboard" : "/pos");
        return;
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router, allowed]);

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>;

  return <>{children}</>;
}