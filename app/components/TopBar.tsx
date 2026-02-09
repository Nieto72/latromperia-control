"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

type TopBarItemProps = {
  href: string;
  label: string;
  active: boolean;
};

function TopBarItem({ href, label, active }: TopBarItemProps) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        textDecoration: "none",
        color: "var(--foreground)",
        border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: active ? "rgba(255,90,95,0.2)" : "var(--surface)",
        fontWeight: 700,
      }}
    >
      {label}
    </Link>
  );
}

export default function TopBar({ title }: { title: string }) {
  const pathname = usePathname();

  return (
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: "rgba(19,19,26,0.6)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <TopBarItem href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
          <TopBarItem href="/users" label="Usuarios" active={pathname === "/users"} />
          <TopBarItem href="/inventory" label="Inventario" active={pathname === "/inventory"} />
          <TopBarItem href="/products" label="Productos" active={pathname === "/products"} />
        </div>
      </div>

      <LogoutButton />
    </div>
  );
}
