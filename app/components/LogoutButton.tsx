"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../lib/firebase";

export default function LogoutButton() {
  const router = useRouter();

  const handle = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  return (
    <button
      onClick={handle}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.2)",
        background: "transparent",
        color: "white",
        cursor: "pointer",
        fontWeight: 700,
      }}
    >
      Salir
    </button>
  );
}