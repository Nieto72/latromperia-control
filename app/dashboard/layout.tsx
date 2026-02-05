"use client";

import type { ReactNode } from "react";
import RoleGuard from "../components/RoleGuard";
import type { Role } from "../lib/types";

const ADMIN_ONLY: Role[] = ["admin"];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={ADMIN_ONLY}>{children}</RoleGuard>;
}
