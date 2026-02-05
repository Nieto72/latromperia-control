"use client";

import type { ReactNode } from "react";
import RoleGuard from "../components/RoleGuard";
import type { Role } from "../lib/types";

const POS_ROLES: Role[] = ["admin", "cashier"];

export default function POSLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={POS_ROLES}>{children}</RoleGuard>;
}
