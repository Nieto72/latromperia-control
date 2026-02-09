"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { LineItem, OrderDoc, OrderType, PayMethod, ProductDoc } from "../lib/models";
import type { WithId } from "../lib/converters";
import { ingredientConverter, inventoryConverter, orderConverter, productConverter, recipeConverter } from "../lib/converters";
import { useAuth } from "../components/AuthProvider";

type Item = LineItem;
type Addition = LineItem;

type OrderRow = WithId<OrderDoc>;
type ProductRow = WithId<ProductDoc>;

function calcTotal(items: Item[], adds: Addition[]) {
  const a = items.reduce((s, it) => s + it.price * it.qty, 0);
  const b = adds.reduce((s, it) => s + it.price * it.qty, 0);
  return a + b;
}

export default function POSPage() {
  // pedido actual (cuenta abierta)
  const [orderId, setOrderId] = useState<string | null>(null);
  const [label, setLabel] = useState<string>(""); // Nombre del cliente
  const [orderType, setOrderType] = useState<OrderType>("aqui");
  const [payMethod, setPayMethod] = useState<PayMethod>("Efectivo");

  const [cart, setCart] = useState<Item[]>([]);
  const [additions, setAdditions] = useState<Addition[]>([]);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);

  // lista pedidos abiertos
  const [openOrders, setOpenOrders] = useState<OrderRow[]>([]);
  const [search, setSearch] = useState("");
  const [ordersOpen, setOrdersOpen] = useState(false);

  const { user, role, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;
  const canViewAllOrders = role === "admin";
  const canAdjustInventory = role === "admin";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [additionsCatalog, setAdditionsCatalog] = useState<ProductRow[]>([]);

  const total = useMemo(() => calcTotal(cart, additions), [cart, additions]);
  const isOrderOpen = !!orderId;

  // ====== helpers de items ======
  const addProduct = (p: ProductRow) => {
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

  const addAddition = (a: ProductRow) => {
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

  const clearLocal = () => {
    setCart([]);
    setAdditions([]);
  };

  // ====== Firestore: pedidos abiertos ======
  const loadOpenOrders = useCallback(async () => {
    if (!uid) return;

    const ordersCol = collection(db, "orders").withConverter(orderConverter);
    const base = [ordersCol, where("status", "==", "open"), orderBy("createdAt", "desc")] as const;
    const qy = canViewAllOrders ? query(...base) : query(...base, where("createdBy", "==", uid));
    const snap = await getDocs(qy);

    const list: OrderRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        status: data.status ?? "open",
        label: data.label ?? "(sin nombre)",
        orderType: data.orderType ?? "aqui",
        items: data.items ?? [],
        additions: data.additions ?? [],
        total: data.total ?? 0,
        createdAt: data.createdAt ?? null,
        updatedAt: data.updatedAt ?? null,
        createdBy: data.createdBy ?? "",
        closedAt: data.closedAt ?? null,
      };
    });

    setOpenOrders(list);
  }, [canViewAllOrders, uid]);

  useEffect(() => {
    if (authLoading) return;
    void loadOpenOrders();
  }, [authLoading, loadOpenOrders]);

  useEffect(() => {
    const productsCol = collection(db, "products").withConverter(productConverter);
    const qy = query(productsCol, orderBy("name", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.isActive !== false);

      const additionsList = list.filter((p) => (p.category ?? "").toLowerCase() === "adiciones");
      const mainList = list.filter((p) => (p.category ?? "").toLowerCase() !== "adiciones");

      setProducts(mainList);
      setAdditionsCatalog(additionsList);
    });

    return () => unsub();
  }, []);

  const createOrder = async () => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return alert("Pon el nombre del cliente (ej: Nacho).");
    if (!uid) return alert("No estás logueado. Inicia sesión como cashier/admin.");

    setSaving(true);
    try {
      const ordersCol = collection(db, "orders").withConverter(orderConverter);
      const res = await addDoc(ordersCol, {
        status: "open",
        label: cleanLabel,
        orderType, // ✅ clave para rules (y para tenerlo guardado)
        items: cart,
        additions,
        total,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: uid,
      });

      setOrderId(res.id);
      await loadOpenOrders();
      alert(`Pedido abierto ✅ (${cleanLabel})`);
    } catch {
      alert("No se pudo crear el pedido ❌");
    } finally {
      setSaving(false);
    }
  };

  const selectOrder = async (oid: string) => {
    const found = openOrders.find((o) => o.id === oid);
    if (!found) return;

    setOrderId(found.id);
    setLabel(found.label);
    setOrderType(found.orderType);
    setCart(found.items || []);
    setAdditions(found.additions || []);
    setOrdersOpen(false);
  };

  const syncOrder = async () => {
    if (!orderId) return;
    if (!uid) return alert("No estás logueado. Inicia sesión como cashier/admin.");

    setSaving(true);
    try {
      const ordersCol = collection(db, "orders").withConverter(orderConverter);
      await updateDoc(doc(ordersCol, orderId), {
        label: label.trim() || "(sin nombre)",
        orderType,
        items: cart,
        additions,
        total,
        updatedAt: serverTimestamp(),
        // ✅ NO tocar createdBy
      });

      await loadOpenOrders();
      alert("Pedido guardado ✅");
    } catch {
      alert("No se pudo guardar el pedido ❌");
    } finally {
      setSaving(false);
    }
  };

  const closeAndPay = async () => {
    if (!orderId) return alert("Primero abre un pedido (nombre del cliente).");
    if (!cart.length) return alert("El pedido está vacío.");
    if (!uid) return alert("No estás logueado. Inicia sesión como cashier/admin.");

    setSaving(true);
    try {
      const lineItems = [...cart, ...additions];

      const buildUsage = async () => {
        const usage = new Map<string, number>();
        const missing: string[] = [];
        const recipesCol = collection(db, "recipes").withConverter(recipeConverter);

        for (const item of lineItems) {
          const recipeRef = doc(recipesCol, item.id);
          const recipeSnap = await getDoc(recipeRef);
          if (!recipeSnap.exists()) {
            missing.push(item.name);
            continue;
          }
          const recipe = recipeSnap.data();
          for (const recipeItem of recipe.items ?? []) {
            const current = usage.get(recipeItem.ingredientId) ?? 0;
            usage.set(recipeItem.ingredientId, current + recipeItem.qty * item.qty);
          }
        }

        return { usage, missing };
      };

      const { usage, missing } = canAdjustInventory ? await buildUsage() : { usage: new Map(), missing: [] };

      const salesCol = collection(db, "sales");
      const ordersCol = collection(db, "orders").withConverter(orderConverter);
      const saleRef = doc(salesCol);
      const orderRef = doc(ordersCol, orderId);
      const counterRef = doc(db, "counters", "tickets");
      const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
      const inventoryCol = collection(db, "inventory").withConverter(inventoryConverter);

      await runTransaction(db, async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const current = counterSnap.exists() ? (counterSnap.data().value as number | undefined) ?? 0 : 0;
        const next = current + 1;

        tx.set(counterRef, { value: next }, { merge: true });

        if (canAdjustInventory) {
          for (const [ingredientId, qty] of usage.entries()) {
            const ingredientRef = doc(ingredientsCol, ingredientId);
            const ingredientSnap = await tx.get(ingredientRef);
            if (!ingredientSnap.exists()) {
              throw new Error("Ingrediente no encontrado");
            }
            const ingredient = ingredientSnap.data();
            const currentStock = ingredient.stock ?? 0;
            if (currentStock < qty) {
              throw new Error(`Stock insuficiente: ${ingredient.name}`);
            }
            const nextStock = currentStock - qty;

            tx.update(ingredientRef, {
              stock: nextStock,
              updatedAt: serverTimestamp(),
            });

            const movementRef = doc(inventoryCol);
            tx.set(movementRef, {
              ingredientId,
              qty,
              type: "out",
              note: `Venta #${next}`,
              delta: -qty,
              beforeStock: currentStock,
              afterStock: nextStock,
              createdAt: serverTimestamp(),
              createdBy: uid,
            });
          }
        }

        tx.set(saleRef, {
          orderId,
          label: label.trim() || "(sin nombre)",
          items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
          additions: additions.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
          total,
          payMethod,
          orderType,
          ticketNumber: next,
          createdAt: serverTimestamp(),
          createdBy: uid,
        });

        tx.update(orderRef, {
          status: "closed",
          closedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // 3) reset local
      setOrderId(null);
      setLabel("");
      setOrderType("aqui");
      clearLocal();
      await loadOpenOrders();

      alert("Venta guardada y pedido cerrado ✅");
      if (!canAdjustInventory) {
        alert("Inventario no descontado (solo admin).");
      } else if (missing.length > 0) {
        alert(`Venta guardada, pero faltan recetas para: ${missing.join(", ")}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cerrar/pagar ❌ (revisa rules / conexión)";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const openOrdersFiltered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return openOrders;
    return openOrders.filter((o) => (o.label || "").toLowerCase().includes(s) || o.id.includes(s));
  }, [openOrders, search]);

  return (
    <div className="posWrap" style={{ padding: 16 }}>
      <style>{`
        .posWrap { max-width: 1100px; margin: 0 auto; }

        .posGrid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
          margin-top: 16px;
          align-items: start;
        }

        @media (max-width: 820px) { .posGrid { grid-template-columns: 1fr; } }

        .card { border: 1px solid var(--border); border-radius: 16px; padding: 12px; background: var(--card); box-shadow: 0 18px 40px rgba(0,0,0,0.28); }

        .productsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (max-width: 420px) {
          .productsGrid { gap: 8px; }
          .btnProduct { padding: 10px !important; border-radius: 14px !important; }
        }

        .topBar {
          display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:12px;
        }

        .mobileBar { display:none; }

        .desktopActions { display:flex; gap:10px; margin-top:14px; }

        @media (max-width: 820px) {
          .desktopActions { display:none; }
          .mobileBar {
            display:grid;
            gap:10px;
            position: sticky;
            bottom: 10px;
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(10px);
            padding: 12px;
            border-radius: 16px;
            border: 1px solid var(--border);
            margin-top: 14px;
            z-index: 50;
          }
          .mobileTotal { display:flex; justify-content:space-between; font-weight:900; font-size:18px; color:var(--foreground); }
          .mobilePay { display:flex; gap:8px; flex-wrap:wrap; }
          .mobilePay button{
            flex:1;
            min-width: 110px;
            padding:10px 12px;
            border-radius:14px;
            border:1px solid var(--border);
            background: var(--card);
            color: var(--foreground);
            font-weight:900;
          }
          .mobilePay button.payActive{ background: var(--accent); color:#0b0b0f; }
          .payMain{
            width:100%;
            padding:14px;
            border-radius:14px;
            border:1px solid var(--border);
            background: var(--accent);
            color:#0b0b0f;
            font-weight:900;
            font-size:16px;
          }
          .payMain:disabled{ opacity:.6; cursor:not-allowed; }
        }

        .modalOverlay{
          position:fixed; inset:0; background: rgba(0,0,0,.55);
          display:flex; align-items:center; justify-content:center; padding:14px; z-index:9999;
        }
        .modalCard{
          width: min(720px, 96vw);
          background: var(--card);
          color: var(--foreground);
          border-radius:16px;
          border:1px solid var(--border);
          padding:14px;
        }
      `}</style>

      <h1 style={{ margin: 0 }}>POS — Pedidos abiertos</h1>

      <div className="topBar">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nombre del cliente..."
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid var(--border)",
            minWidth: 240,
            flex: "1 1 240px",
            background: "var(--surface)",
            color: "var(--foreground)",
          }}
        />

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

        {!isOrderOpen ? (
          <button onClick={createOrder} disabled={saving} style={{ ...actionBtn, fontWeight: 900 }}>
            {saving ? "Creando..." : "Abrir pedido"}
          </button>
        ) : (
          <>
            <button onClick={syncOrder} disabled={saving} style={{ ...actionBtn, fontWeight: 900 }}>
              {saving ? "Guardando..." : "Guardar pedido"}
            </button>
            <button
              onClick={async () => {
                const shouldSave = window.confirm("¿Guardar pedido actual antes de abrir uno nuevo?");
                if (shouldSave) await syncOrder();
                setOrderId(null);
                setLabel("");
                setOrderType("aqui");
                clearLocal();
              }}
              disabled={saving}
              style={{ ...actionBtn, fontWeight: 900 }}
            >
              Nuevo pedido
            </button>
          </>
        )}

        <button
          onClick={() => {
            setOrdersOpen(true);
            loadOpenOrders();
          }}
          style={{ ...actionBtn, fontWeight: 900 }}
        >
          Pedidos abiertos ({openOrders.length})
        </button>

        <button onClick={() => setAddOpen(true)} style={{ ...actionBtn, fontWeight: 900 }}>
          Adiciones +
        </button>
      </div>

      <div className="posGrid">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Productos</h2>

          <div className="productsGrid">
            {products.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No hay productos activos.</div>
            ) : (
              products.map((p) => (
                <button key={p.id} onClick={() => addProduct(p)} style={productBtn} className="btnProduct">
                <div style={{ fontWeight: 900, color: "var(--foreground)" }}>{p.name}</div>
                <div style={{ color: "var(--foreground)", opacity: 0.75 }}>${p.price.toLocaleString("es-CO")}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>
            Pedido {isOrderOpen ? `— ${label || "(sin nombre)"}` : "— (sin abrir)"}
          </h2>

          {!isOrderOpen && (
            <p style={{ opacity: 0.8, marginTop: 8 }}>
              1) Escribe el nombre arriba → 2) <b>Abrir pedido</b> → 3) agrega productos → 4) cuando pidan cuenta:{" "}
              <b>PAGAR</b>
            </p>
          )}

          {cart.length === 0 && additions.length === 0 ? (
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

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Pago</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["Efectivo", "Nequi", "Transferencia"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  style={{ ...payBtn, background: payMethod === m ? "#f1f1f1" : "#fff" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="desktopActions">
            <button onClick={clearLocal} style={{ ...actionBtn, fontWeight: 900 }}>
              Limpiar (local)
            </button>

            <button
              onClick={closeAndPay}
              disabled={saving || !isOrderOpen || cart.length === 0}
              style={{ ...actionBtn, flex: 1.2, fontWeight: 900 }}
            >
              {saving ? "Procesando..." : "Pagar / Cerrar pedido"}
            </button>
          </div>

          <div className="mobileBar">
            <div className="mobileTotal">
              <span>Total</span>
              <strong>${total.toLocaleString("es-CO")}</strong>
            </div>

            <div className="mobilePay">
              {(["Efectivo", "Nequi", "Transferencia"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)} className={payMethod === m ? "payActive" : ""}>
                  {m}
                </button>
              ))}
            </div>

            <button onClick={closeAndPay} disabled={saving || !isOrderOpen || cart.length === 0} className="payMain">
              {saving ? "Procesando..." : "PAGAR / CERRAR"}
            </button>

            <button onClick={clearLocal} className="payMain">
              LIMPIAR
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <div className="modalOverlay" onClick={() => setAddOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Adiciones</h3>
              <button onClick={() => setAddOpen(false)} style={closeBtn}>
                Cerrar
              </button>
            </div>

            <p style={{ marginTop: 8, opacity: 0.8 }}>Toca para agregar al pedido actual.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {additionsCatalog.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No hay adiciones activas.</div>
              ) : (
                additionsCatalog.map((a) => (
                  <button key={a.id} onClick={() => addAddition(a)} style={productBtn}>
                  <div style={{ fontWeight: 900, color: "var(--foreground)" }}>{a.name}</div>
                  <div style={{ color: "var(--foreground)", opacity: 0.75 }}>+ ${a.price.toLocaleString("es-CO")}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {ordersOpen && (
        <div className="modalOverlay" onClick={() => setOrdersOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Pedidos abiertos</h3>
              <button onClick={() => setOrdersOpen(false)} style={closeBtn}>
                Cerrar
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar: Nombre..."
                style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border)", flex: "1 1 220px", background: "var(--surface)", color: "var(--foreground)" }}
              />
              <button onClick={loadOpenOrders} style={{ ...actionBtn, fontWeight: 900 }}>
                Recargar
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {openOrdersFiltered.length === 0 ? (
                <p style={{ opacity: 0.8 }}>No hay pedidos abiertos.</p>
              ) : (
                openOrdersFiltered.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => selectOrder(o.id)}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 14,
                      padding: 12,
                      background: "var(--card)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "var(--foreground)" }}>{o.label}</div>
                    <div style={{ opacity: 0.8, color: "var(--foreground)" }}>
                      Total: ${o.total.toLocaleString("es-CO")} • Items: {(o.items?.length || 0) + (o.additions?.length || 0)}
                    </div>
                    <div style={{ opacity: 0.6, color: "var(--foreground)", fontSize: 12 }}>
                      ID: {o.id.slice(0, 10)}...
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== styles ====== */

const productBtn: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "linear-gradient(180deg, rgba(255, 209, 102, 0.55), rgba(255, 209, 102, 0.25))",
  color: "var(--foreground)",
  cursor: "pointer",
  textAlign: "left",
  boxShadow: "0 12px 24px rgba(0,0,0,0.25)",
};

const payBtn: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  cursor: "pointer",
  fontWeight: 900,
  boxShadow: "0 10px 20px rgba(0,0,0,0.2)",
};

const pillBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--foreground)",
  cursor: "pointer",
  fontWeight: 900,
};

const pillActive: CSSProperties = {
  background: "var(--accent)",
  color: "#0b0b0f",
};

const actionBtn: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--accent)",
  color: "#0b0b0f",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(255, 90, 95, 0.2)",
};

const minusBtn: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "8px 10px",
  cursor: "pointer",
  background: "var(--card)",
  color: "var(--foreground)",
  fontWeight: 900,
};

const closeBtn: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  cursor: "pointer",
  fontWeight: 900,
  color: "var(--foreground)",
};
