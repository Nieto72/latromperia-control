"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import type { FirebaseError } from "firebase/app";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";
import { fetchUserProfile } from "../lib/users";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1) Login con Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const uid = cred.user.uid;

      // 2) Buscar perfil del usuario en Firestore
      const profile = await fetchUserProfile(uid);
      if (!profile) {
        setError("Tu usuario no tiene perfil en Firestore (users).");
        return;
      }

      // 3) Validar activo (boolean o string por seguridad)
      if (!profile.isActive) {
        setError("Usuario desactivado. Contacta al administrador.");
        return;
      }

      // 4) Redirigir según rol
      const role = profile.role;
      if (role === "admin") {
        router.replace("/dashboard");
      } else if (role === "cashier") {
        router.replace("/pos");
      } else {
        setError("Rol no válido en Firestore.");
      }
    } catch (err: unknown) {
      // ✅ Mostrar error real para diagnosticar
      const fbErr = err as FirebaseError | null;
      const code = fbErr?.code || "error";
      const msg = fbErr?.message || "Fallo al iniciar sesión";
      setError(`${code} — ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 400,
        margin: "80px auto",
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--card)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>La Trompería – Control</h1>

      <input
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
        }}
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleLogin();
        }}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
        }}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          fontWeight: 700,
          cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "var(--surface)" : "var(--accent)",
          color: loading ? "var(--muted)" : "#0b0b0f",
          boxShadow: "0 12px 24px rgba(255, 90, 95, 0.25)",
        }}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>

      {error && <p style={{ color: "#ff6b6b", marginTop: 14 }}>{error}</p>}
    </div>
  );
}
