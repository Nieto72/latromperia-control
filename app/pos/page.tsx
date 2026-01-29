"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

const PRODUCTS = [
  { id: "smash_burger", name: "Smash Burger", price: 16000 },
  { id: "smash_americana", name: "Smash Americana", price: 19000 },
  { id: "trompo_burger", name: "Trompo Burger", price: 20000 },
  { id: "la_chingona", name: "La Chingona", price: 19000 },
  { id: "la_irresponsable", name: "La Irresponsable", price: 27000 },
  { id: "shawarma", name: "Shawarma", price: 18000 },
  { id: "tacos_trompo", name: "Tacos del Trompo", price: 16000 },
  { id: "sandwich", name: "Sandwich", price: 16000 },
  { id: "papas_francesa", name: "Papas Francesa", price: 5000 },
  { id: "papas_criollas", name: "Papas Criollas", price: 6000 },
  { id: "bebida", name: "Bebida", price: 4000 },
] as const;

const ADDITIONS = [
  { id: "queso", name: "Queso", price: 2000 },
  { id: "tocineta", name: "Tocineta", price: 3000 },
  { id: "jalapenos", name: "Jalapeños", price: 1000 },
  { id: "pepinillos", name: "Pepinillos", price: 1000 }, // ✅ NUEVO
  { id: "salsa_extra", name: "Salsa extra", price: 500 },
] as const;

type Item = { id: string; name: string; price: number; qty: number };
type Addition = { id: string; name: string; price: number; qty: number };

type PayMethod = "Efectivo" | "Nequi" | "Transferencia";
type OrderType = "aqui" | "llevar";

export default function POSPage() {
  const [cart, setCart] = useState<Item[]>([]);
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [payMethod, setPayMethod] = useState<PayMethod>("Efectivo");
  const [orderType, setOrderType] = useState<OrderType>("aqui");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const totalProducts = useMemo(
    () => cart.reduce((sum, it) => sum + it.price * it.qty, 0),
    [cart]
  );

  const totalAdditions = useMemo(
    () => additions.reduce((sum, it) => sum + it.price * it.qty, 0),
    [additions]
  );

  const total = useMemo(() => totalProducts + totalAdditions, [totalProducts, totalAdditions]);

  const addProduct = (p: (typeof PRODUCTS)[number]) => {
    setCart((prev) => {
      const found = prev.find((x) => x.id === p.id);
      if (found) return prev.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  };

  const decProduct = (id: string) => {
    setCart((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  };

  const addAddition = (a: (typeof ADDITIONS)[number]) => {
    setAdditions((prev) => {
      const found = prev.find((x) => x.id === a.id);
      if (found) return prev.map((x) => (x.id === a.id ? { ...x, qty: x.qty + 1 } : x));
      return [...prev, { id: a.id, name: a.name, price: a.price, qty: 1 }];
    });
  };

  const decAddition = (id: string) => {
    setAdditions((prev) =>
      prev
        .map((x) => (x.id === id ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  };

  const clear = () => {
    setCart([]);
    setAdditions([]);
  };

  const saveSale = async () => {
    if (!cart.length) return;

    setSaving(true);
    try {
      await addDoc(collection(db, "sales"), {
        items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
        additions: additions.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
        total,
        payMethod,
        orderType,
        createdAt: serverTimestamp(),
      });

      clear();
      alert("Venta guardada ✅");
    } catch (e) {
      alert("No se pudo guardar la venta ❌");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0 }}>POS — Caja</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16, marginTop: 16 }}>
        {/* Productos */}
        <div style={{ border: "1px solid #ddd", borderRadius: 16, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Productos</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {PRODUCTS.map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} style={productBtn}>
                <div style={{ fontWeight: 900, color: "#000" }}>{p.name}</div>
                <div style={{ color: "#000", opacity: 0.75 }}>${p.price.toLocaleString("es-CO")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pedido */}
        <div style={{ border: "1px solid #ddd", borderRadius: 16, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Pedido</h2>

          {/* Tipo de orden */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => setOrderType("aqui")}
              style={{ ...pillBtn, ...(orderType === "aqui" ? pillActive : undefined) }}
            >
              Comer aquí
            </button>

            <button
              onClick={() => setOrderType("llevar")}
              style={{ ...pillBtn, ...(orderType === "llevar" ? pillActive : undefined) }}
            >
              Para llevar
            </button>

            {/* ✅ Adiciones resaltado */}
            <button
              onClick={() => setAddOpen(true)}
              style={{ ...pillBtn, marginLeft: "auto", background: "#fff", color: "#000" }}
            >
              Adiciones +
            </button>
          </div>

          {/* Items */}
          {cart.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Agrega productos para iniciar.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {cart.map((it) => (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{it.name}</div>
                    <div style={{ opacity: 0.8 }}>
                      {it.qty} × ${it.price.toLocaleString("es-CO")}
                    </div>
                  </div>
                  <button onClick={() => decProduct(it.id)} style={minusBtn}>
                    -1
                  </button>
                </div>
              ))}

              {additions.length > 0 && (
                <>
                  <div style={{ opacity: 0.7, marginTop: 8, fontWeight: 900 }}>Adiciones</div>
                  {additions.map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{a.name}</div>
                        <div style={{ opacity: 0.8 }}>
                          {a.qty} × ${a.price.toLocaleString("es-CO")}
                        </div>
                      </div>
                      <button onClick={() => decAddition(a.id)} style={minusBtn}>
                        -1
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <hr style={{ margin: "14px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18 }}>
            <span>Total</span>
            <span>${total.toLocaleString("es-CO")}</span>
          </div>

          {/* Pago */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Pago</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["Efectivo", "Nequi", "Transferencia"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  style={{
                    ...payBtn,
                    background: payMethod === m ? "#f1f1f1" : "#fff",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={clear} style={{ ...actionBtn, fontWeight: 900 }}>
              Borrar
            </button>

            <button
              onClick={saveSale}
              disabled={saving || cart.length === 0}
              style={{ ...actionBtn, flex: 1.2, fontWeight: 900 }}
            >
              {saving ? "Guardando..." : "Pagar"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de adiciones */}
      {addOpen && (
        <div style={modalOverlay} onClick={() => setAddOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Adiciones</h3>
              <button onClick={() => setAddOpen(false)} style={closeBtn}>
                Cerrar
              </button>
            </div>

            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Toca para agregar. Se suman al total y se guardan en la venta.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {ADDITIONS.map((a) => (
                <button key={a.id} onClick={() => addAddition(a)} style={productBtn}>
                  <div style={{ fontWeight: 900, color: "#000" }}>{a.name}</div>
                  <div style={{ color: "#000", opacity: 0.75 }}>+ ${a.price.toLocaleString("es-CO")}</div>
                </button>
              ))}
            </div>

            {additions.length > 0 && (
              <>
                <hr style={{ margin: "14px 0" }} />
                <div style={{ fontWeight: 900, marginBottom: 8 }}>En esta orden</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {additions.map((a) => (
                    <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>{a.name}</div>
                        <div style={{ opacity: 0.8 }}>
                          {a.qty} × ${a.price.toLocaleString("es-CO")}
                        </div>
                      </div>
                      <button onClick={() => decAddition(a.id)} style={minusBtn}>
                        -1
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== styles ====== */

const productBtn: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #333",
  background: "#fff",
  color: "#000",
  cursor: "pointer",
  textAlign: "left",
};

const payBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid #333",
  background: "#fff",
  color: "#000",
  cursor: "pointer",
  fontWeight: 900,
};

const pillBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid #333",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const pillActive: React.CSSProperties = {
  background: "#fff",
  color: "#000",
};

const actionBtn: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #333",
  background: "#fff",
  color: "#000",
  cursor: "pointer",
};

const minusBtn: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 12,
  padding: "8px 10px",
  cursor: "pointer",
  background: "#fff",
  color: "#000",
  fontWeight: 900,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
  zIndex: 9999,
};

const modalCard: React.CSSProperties = {
  width: "min(720px, 96vw)",
  background: "#fff",
  color: "#000",
  borderRadius: 16,
  border: "1px solid #ddd",
  padding: 14,
};

const closeBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #333",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
  color: "#000",
};
