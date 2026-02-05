"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../../lib/firebase";

import type { Role, UserDoc } from "../../lib/types";
import { normalizeIsActive } from "../../lib/types";

export default function UsersPage() {
  const [users, setUsers] = useState<{ id: string; data: UserDoc }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, data: d.data() as UserDoc }));
      setUsers(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleActive = async (uid: string, current: boolean) => {
    setMsg("");
    await updateDoc(doc(db, "users", uid), { isActive: !current });
    setMsg("Listo ✅ usuario actualizado");
  };

  const setRole = async (uid: string, role: Role) => {
    setMsg("");
    await updateDoc(doc(db, "users", uid), { role });
    setMsg("Rol actualizado ✅");
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Usuarios</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Controla acceso: rol e isActive
      </p>

      {msg && <p style={{ color: "#7CFC00" }}>{msg}</p>}

      <div style={{ display: "grid", gap: 12, maxWidth: 700 }}>
        {users.map(({ id, data }) => {
          const name = data.displayName || "(sin nombre)";
          const role = (data.role || "") as string;
          const isActive = normalizeIsActive(data.isActive);

          return (
            <div
              key={id}
              style={{
                border: "1px solid #2a2a2a",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{name}</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>UID: {id.slice(0, 10)}...</div>

                  <div style={{ marginTop: 6 }}>
                    <span style={{ opacity: 0.8 }}>Rol:</span>{" "}
                    <b>{role || "(sin rol)"}</b>{" "}
                    <span style={{ opacity: 0.8, marginLeft: 10 }}>Estado:</span>{" "}
                    <b>{isActive ? "Activo" : "Desactivado"}</b>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => toggleActive(id, isActive)} style={btn}>
                    {isActive ? "Desactivar" : "Activar"}
                  </button>

                  <select
                    value={data.role || ""}
                    onChange={(e) => {
                      const next = e.target.value as Role;
                      if (next === "admin" || next === "cashier") setRole(id, next);
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #333",
                      background: "transparent",
                    }}
                  >
                    <option value="" disabled>
                      (Elegir rol)
                    </option>
                    <option value="admin">admin</option>
                    <option value="cashier">cashier</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #333",
  fontWeight: 800,
  background: "transparent",
  cursor: "pointer",
};
