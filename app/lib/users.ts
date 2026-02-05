import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Role, UserDoc } from "./types";
import { normalizeIsActive, normalizeRole } from "./types";

export type UserProfile = {
  data: UserDoc;
  isActive: boolean;
  role: Role | null;
};

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as UserDoc;
  return {
    data,
    isActive: normalizeIsActive(data.isActive),
    role: normalizeRole(data.role),
  };
}
