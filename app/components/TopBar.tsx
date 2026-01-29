"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function TopBar({ title }: { title: string }) {
  const pathname = usePathname();

  const Item = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          textDecoration: "none",
          color: "white",
          border: active ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.12)",
          background: active ? "rgba(255,255,255,0.08)" : "transparent",
          fontWeight: 700,
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Item href="/dashboard" label="Dashboard" />
          <Item href="/users" label="Usuarios" />
          <Item href="/inventory" label="Inventario" />
          <Item href="/products" label="Productos" />
        </div>
      </div>

      <LogoutButton />
    </div>
  );
}
