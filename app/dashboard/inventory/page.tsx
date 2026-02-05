"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ingredientConverter, inventoryConverter, type WithId } from "../../lib/converters";
import type { IngredientDoc, InventoryMovementDoc, InventoryMovementType } from "../../lib/models";
import { addInventoryMovement } from "../../lib/repos/ingredients";
import { useAuth } from "../../components/AuthProvider";

type IngredientRow = WithId<IngredientDoc>;
type MovementRow = WithId<InventoryMovementDoc>;

const movementTypes: { value: InventoryMovementType; label: string; hint: string }[] = [
  { value: "in", label: "Entrada", hint: "Suma al stock" },
  { value: "out", label: "Salida", hint: "Resta del stock" },
  { value: "adjustment", label: "Ajuste", hint: "Define nuevo stock" },
];

export default function InventoryPage() {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [ingredientId, setIngredientId] = useState("");
  const [type, setType] = useState<InventoryMovementType>("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
    const ingredientsQuery = query(ingredientsCol, orderBy("name", "asc"));
    const unsubIngredients = onSnapshot(ingredientsQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIngredients(list);
    });

    const inventoryCol = collection(db, "inventory").withConverter(inventoryConverter);
    const inventoryQuery = query(inventoryCol, orderBy("createdAt", "desc"), limit(50));
    const unsubInventory = onSnapshot(inventoryQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMovements(list);
      setLoading(false);
    });

    return () => {
      unsubIngredients();
      unsubInventory();
    };
  }, []);

  const ingredientMap = useMemo(() => {
    return ingredients.reduce<Record<string, IngredientRow>>((acc, ingredient) => {
      acc[ingredient.id] = ingredient;
      return acc;
    }, {});
  }, [ingredients]);

  const parseNumber = (value: string) => {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const handleSubmit = async () => {
    setMsg("");
    if (!user) {
      setMsg("No hay sesión activa.");
      return;
    }

    if (!ingredientId) {
      setMsg("Selecciona un ingrediente.");
      return;
    }

    const qtyValue = parseNumber(qty);
    if (qtyValue === null || qtyValue < 0) {
      setMsg("Cantidad inválida.");
      return;
    }

    if (type !== "adjustment" && qtyValue === 0) {
      setMsg("La cantidad debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      await addInventoryMovement({
        ingredientId,
        qty: qtyValue,
        type,
        note: note.trim() || undefined,
        createdBy: user.uid,
      });
      setQty("");
      setNote("");
      setMsg("Movimiento guardado ✅");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Inventario</h1>
        <p style={{ opacity: 0.8 }}>
          Registra entradas, salidas y ajustes con historial.
        </p>
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Registrar movimiento</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} style={inputStyle}>
            <option value="" disabled>
              Selecciona un ingrediente
            </option>
            {ingredients.map((ingredient) => (
              <option key={ingredient.id} value={ingredient.id}>
                {ingredient.name} (stock {ingredient.stock ?? 0})
              </option>
            ))}
          </select>

          <select value={type} onChange={(e) => setType(e.target.value as InventoryMovementType)} style={inputStyle}>
            {movementTypes.map((movement) => (
              <option key={movement.value} value={movement.value}>
                {movement.label}
              </option>
            ))}
          </select>

          <input
            placeholder={type === "adjustment" ? "Nuevo stock" : "Cantidad"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={handleSubmit} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : "Guardar movimiento"}
          </button>
          <span style={{ opacity: 0.75 }}>
            {movementTypes.find((m) => m.value === type)?.hint}
          </span>
        </div>

        {msg && <p style={{ color: msg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{msg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Últimos movimientos</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : movements.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No hay movimientos todavía.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {movements.map((movement) => {
              const ingredient = ingredientMap[movement.ingredientId];
              const delta = movement.delta ?? 0;
              const beforeStock = movement.beforeStock ?? 0;
              const afterStock = movement.afterStock ?? 0;

              return (
                <div key={movement.id} style={rowStyle}>
                  <div>
                    <strong>{ingredient?.name ?? "Ingrediente"}</strong>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {movement.type.toUpperCase()} · {movement.qty} (Δ {delta})
                    </div>
                    {movement.note && <div style={{ opacity: 0.8 }}>{movement.note}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>
                      {beforeStock} → {afterStock}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #333",
  fontWeight: 700,
  background: "white",
  color: "#000",
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
