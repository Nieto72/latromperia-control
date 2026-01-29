"use client";

import type { ReactNode } from "react";
import RoleGuard from "../components/RoleGuard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={["admin"]}>{children}</RoleGuard>;
}
