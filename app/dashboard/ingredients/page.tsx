"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ingredientConverter, type WithId } from "../../lib/converters";
import type { IngredientDoc, IngredientUnit } from "../../lib/models";
import { createIngredient, updateIngredient } from "../../lib/repos/ingredients";

type IngredientRow = WithId<IngredientDoc>;

type IngredientFormState = {
  name: string;
  unit: IngredientUnit;
  category: string;
  costPerUnit: string;
  minStock: string;
  isActive: boolean;
};

const emptyForm: IngredientFormState = {
  name: "",
  unit: "unidad",
  category: "",
  costPerUnit: "",
  minStock: "",
  isActive: true,
};

const unitLabels: Record<IngredientUnit, string> = {
  unidad: "Unidad",
  g: "Gramos",
  ml: "Mililitros",
  porcion: "Porción",
};

type SeedIngredient = {
  name: string;
  unit: IngredientUnit;
  minStock: number;
  costPerUnit?: number;
  category: string;
};

const seedIngredients: SeedIngredient[] = [
  { name: "Carne smash bola 65g", unit: "unidad", minStock: 20, costPerUnit: 1820, category: "Proteína" },
  { name: "Pan brioche", unit: "unidad", minStock: 15, costPerUnit: 2000, category: "Panadería" },
  { name: "Queso loncha", unit: "unidad", minStock: 40, costPerUnit: 345, category: "Lácteos" },
  { name: "Tocineta", unit: "unidad", minStock: 15, costPerUnit: 578, category: "Proteína" },
  { name: "Takis bolsa", unit: "porcion", minStock: 1, costPerUnit: 965, category: "Toppings" },
  { name: "Jalapeños galon", unit: "porcion", minStock: 1, category: "Vegetales" },
  { name: "Pepinillos galon", unit: "porcion", minStock: 1, category: "Vegetales" },
  { name: "Crema agria 185gr", unit: "porcion", minStock: 2, category: "Salsas" },
  { name: "Vegetales mixtos", unit: "porcion", minStock: 15, costPerUnit: 500, category: "Vegetales" },
  { name: "Salsa burger galon", unit: "porcion", minStock: 1, category: "Salsas" },
  { name: "Salsa ajo galon", unit: "porcion", minStock: 1, category: "Salsas" },
  { name: "Salsa tocineta ahumada galon", unit: "porcion", minStock: 1, category: "Salsas" },
  { name: "Sriracha reducida galon", unit: "porcion", minStock: 1, category: "Salsas" },
  { name: "Cebolla crispy 1000g", unit: "porcion", minStock: 1, costPerUnit: 29200, category: "Toppings" },
  { name: "Tomate", unit: "porcion", minStock: 5, costPerUnit: 500, category: "Vegetales" },
  { name: "Cebolla", unit: "porcion", minStock: 5, costPerUnit: 700, category: "Vegetales" },
  { name: "Papas francesa cruda", unit: "porcion", minStock: 8, costPerUnit: 1900, category: "Papas" },
  { name: "Papas criollas cruda", unit: "porcion", minStock: 8, costPerUnit: 2200, category: "Papas" },
  { name: "Coca Cola", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Coca Cola Zero", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Quatro", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Sprite", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Kola Roman", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Ginger", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Soda", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Agua", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
  { name: "Agua con gas", unit: "unidad", minStock: 5, costPerUnit: 2500, category: "Bebidas" },
];

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<IngredientFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [cleanupMsg, setCleanupMsg] = useState("");

  useEffect(() => {
    const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
    const qy = query(ingredientsCol, orderBy("name", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIngredients(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const parseNumber = (value: string) => {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const handleSubmit = async () => {
    setMsg("");
    const name = form.name.trim();
    if (!name) {
      setMsg("Pon un nombre válido.");
      return;
    }

    const minStock = parseNumber(form.minStock);
    if (minStock === null || minStock < 0) {
      setMsg("Stock mínimo inválido.");
      return;
    }

    const costPerUnit = parseNumber(form.costPerUnit);
    if (costPerUnit !== null && costPerUnit < 0) {
      setMsg("Costo inválido.");
      return;
    }

    setSaving(true);
    try {
      if (!editingId) {
        await createIngredient({
          name,
          unit: form.unit,
          category: form.category.trim() || undefined,
          costPerUnit: costPerUnit ?? undefined,
          minStock,
        });
        setMsg("Ingrediente creado ✅");
        resetForm();
        return;
      }

      await updateIngredient(editingId, {
        name,
        unit: form.unit,
        category: form.category.trim() || undefined,
        costPerUnit: costPerUnit ?? undefined,
        minStock,
        isActive: form.isActive,
      });
      setMsg("Ingrediente actualizado ✅");
      resetForm();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error guardando ingrediente.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (ingredient: IngredientRow) => {
    setEditingId(ingredient.id);
    setForm({
      name: ingredient.name ?? "",
      unit: ingredient.unit ?? "unidad",
      category: ingredient.category ?? "",
      costPerUnit: ingredient.costPerUnit != null ? String(ingredient.costPerUnit) : "",
      minStock: ingredient.minStock != null ? String(ingredient.minStock) : "",
      isActive: ingredient.isActive ?? true,
    });
  };

  const seedBaseIngredients = async () => {
    setSeedMsg("");
    setSeeding(true);
    try {
      const existingMap = ingredients.reduce<Record<string, IngredientRow>>((acc, item) => {
        acc[item.name.toLowerCase()] = item;
        return acc;
      }, {});
      for (const seed of seedIngredients) {
        const existing = existingMap[seed.name.toLowerCase()];
        if (existing) {
          await updateIngredient(existing.id, {
            name: seed.name,
            unit: seed.unit,
            category: seed.category,
            costPerUnit: seed.costPerUnit ?? undefined,
            minStock: seed.minStock,
            isActive: true,
          });
        } else {
          await createIngredient({
            name: seed.name,
            unit: seed.unit,
            category: seed.category,
            costPerUnit: seed.costPerUnit,
            minStock: seed.minStock,
          });
        }
      }
      setSeedMsg("Ingredientes cargados ✅");
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "No se pudo cargar ingredientes.");
    } finally {
      setSeeding(false);
    }
  };

  const duplicates = useMemo(() => {
    const map = new Map<string, IngredientRow[]>();
    for (const item of ingredients) {
      const key = item.name.toLowerCase();
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.values()).filter((list) => list.length > 1);
  }, [ingredients]);

  const missingCosts = useMemo(() => {
    return ingredients
      .filter((item) => item.costPerUnit == null || Number.isNaN(item.costPerUnit))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients]);

  const removeDuplicates = async () => {
    setCleanupMsg("");
    if (duplicates.length === 0) {
      setCleanupMsg("No hay duplicados.");
      return;
    }
    try {
      const batch = writeBatch(db);
      for (const group of duplicates) {
        const sorted = [...group].sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return aTime - bTime;
        });
        const [, ...toDelete] = sorted;
        for (const item of toDelete) {
          batch.delete(doc(db, "ingredients", item.id));
        }
      }
      await batch.commit();
      setCleanupMsg("Duplicados eliminados ✅");
    } catch (err) {
      setCleanupMsg(err instanceof Error ? err.message : "No se pudo eliminar duplicados.");
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Ingredientes</h1>
        <p style={{ opacity: 0.8 }}>
          Inventario real del restaurante. El stock se ajusta con movimientos.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12, border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ margin: 0 }}>{editingId ? "Editar ingrediente" : "Nuevo ingrediente"}</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            style={inputStyle}
          />
          <select
            value={form.unit}
            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value as IngredientUnit }))}
            style={inputStyle}
          >
            {Object.entries(unitLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            placeholder="Categoría"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Costo por unidad"
            value={form.costPerUnit}
            onChange={(e) => setForm((prev) => ({ ...prev, costPerUnit: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Stock mínimo"
            value={form.minStock}
            onChange={(e) => setForm((prev) => ({ ...prev, minStock: e.target.value }))}
            style={inputStyle}
          />
        </div>

        {editingId && (
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Activo
          </label>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={handleSubmit} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear ingrediente"}
          </button>
          {editingId && (
            <button onClick={resetForm} disabled={saving} style={secondaryButton}>
              Cancelar
            </button>
          )}
        </div>

        {msg && <p style={{ color: msg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{msg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Listado</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : ingredients.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No hay ingredientes todavía.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {Object.entries(
              ingredients.reduce<Record<string, IngredientRow[]>>((acc, item) => {
                const key = item.category || "Sin categoría";
                acc[key] = acc[key] ? [...acc[key], item] : [item];
                return acc;
              }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, items]) => (
                <div key={category} style={{ display: "grid", gap: 10 }}>
                  <h4 style={{ margin: 0, opacity: 0.8 }}>{category}</h4>
                  {items
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((ingredient) => (
                      <div key={ingredient.id} style={rowStyle}>
                        <div>
                          <strong>{ingredient.name}</strong>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            {unitLabels[ingredient.unit] ?? ingredient.unit}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          <span>Stock: {ingredient.stock ?? 0}</span>
                          <span>Mínimo: {ingredient.minStock ?? 0}</span>
                          <span style={{ opacity: 0.8 }}>{ingredient.isActive ? "Activo" : "Inactivo"}</span>
                          <button onClick={() => startEdit(ingredient)} style={secondaryButton}>
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Ingredientes sin costo</h3>
        {missingCosts.length === 0 ? (
          <p style={{ opacity: 0.8 }}>Todo tiene costo ✅</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {missingCosts.map((ingredient) => (
              <div key={ingredient.id} style={rowStyle}>
                <div>
                  <strong>{ingredient.name}</strong>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    {ingredient.category || "Sin categoría"} · {unitLabels[ingredient.unit] ?? ingredient.unit}
                  </div>
                </div>
                <button onClick={() => startEdit(ingredient)} style={secondaryButton}>
                  Editar costo
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ border: "1px dashed #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Carga inicial</h3>
        <p style={{ opacity: 0.8, marginTop: 4 }}>
          Carga la base de ingredientes con costos y mínimos. Si el ingrediente ya existe, se omite.
        </p>
        <button onClick={seedBaseIngredients} disabled={seeding} style={buttonStyle}>
          {seeding ? "Cargando..." : "Cargar ingredientes base"}
        </button>
        {seedMsg && <p style={{ marginTop: 10, color: seedMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{seedMsg}</p>}

        <div style={{ marginTop: 10 }}>
          <button onClick={removeDuplicates} style={secondaryButton}>
            Eliminar duplicados por nombre
          </button>
          {cleanupMsg && <p style={{ marginTop: 8, color: cleanupMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{cleanupMsg}</p>}
        </div>
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

const secondaryButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #333",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  fontWeight: 600,
};

const rowStyle: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};
