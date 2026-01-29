"use client";

import type { ReactNode } from "react";
import RoleGuard from "../components/RoleGuard";

export default function POSLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowed={["admin", "cashier"]}>{children}</RoleGuard>;
}
