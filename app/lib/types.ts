export type Role = "admin" | "cashier";

export type UserDoc = {
  displayName?: string;
  role?: Role;
  isActive?: boolean | "true" | "false";
};

export const normalizeIsActive = (value: UserDoc["isActive"]) => value === true || value === "true";

export const normalizeRole = (value: UserDoc["role"]): Role | null => {
  if (value === "admin" || value === "cashier") return value;
  return null;
};
