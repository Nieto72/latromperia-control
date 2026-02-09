"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { productConverter, type WithId } from "../../lib/converters";
import type { ProductDoc } from "../../lib/models";
import { createProduct, updateProduct } from "../../lib/repos/products";

type ProductRow = WithId<ProductDoc>;

type ProductFormState = {
  name: string;
  price: string;
  cost: string;
  category: string;
  sku: string;
  isActive: boolean;
};

const emptyForm: ProductFormState = {
  name: "",
  price: "",
  cost: "",
  category: "",
  sku: "",
  isActive: true,
};

type SeedProduct = {
  name: string;
  price: number;
  cost: number;
  category: string;
};

const seedCatalog: SeedProduct[] = [
  { name: "Smash Burger", price: 16000, cost: 6900, category: "Hamburguesas" },
  { name: "Smash Americana", price: 19000, cost: 7500, category: "Hamburguesas" },
  { name: "La Chingona", price: 19000, cost: 8100, category: "Hamburguesas" },
  { name: "La Irresponsable", price: 27000, cost: 12000, category: "Hamburguesas" },
  { name: "Papas Francesa", price: 5000, cost: 1900, category: "Papas" },
  { name: "Papas Criollas", price: 6000, cost: 2200, category: "Papas" },
  { name: "Coca Cola", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Coca Cola Zero", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Quatro", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Sprite", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Kola Roman", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Ginger", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Soda", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Agua", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Agua con gas", price: 4000, cost: 2500, category: "Bebidas" },
  { name: "Queso", price: 3000, cost: 345, category: "Adiciones" },
  { name: "Tocineta", price: 4000, cost: 578, category: "Adiciones" },
  { name: "Pepinillos", price: 3000, cost: 300, category: "Adiciones" },
  { name: "Jalapeños", price: 3000, cost: 300, category: "Adiciones" },
];

const categoryCodeMap: Record<string, string> = {
  Hamburguesas: "HAM",
  Papas: "PAP",
  Bebidas: "BEB",
  Adiciones: "ADD",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  useEffect(() => {
    const productsCol = collection(db, "products").withConverter(productConverter);
    const qy = query(productsCol, orderBy("name", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(list);
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
    const price = parseNumber(form.price);
    const cost = parseNumber(form.cost);
    if (!name) {
      setMsg("Pon un nombre válido.");
      return;
    }

    if (price === null || price < 0) {
      setMsg("Pon un precio válido.");
      return;
    }

    setSaving(true);
    try {
      if (!editingId) {
        await createProduct({
          name,
          price,
          cost: cost ?? undefined,
          category: form.category.trim() || undefined,
          sku: form.sku.trim() || undefined,
        });
        setMsg("Producto creado ✅");
        resetForm();
        return;
      }

      await updateProduct(editingId, {
        name,
        price,
        cost: cost ?? undefined,
        category: form.category.trim() || undefined,
        sku: form.sku.trim() || undefined,
        isActive: form.isActive,
      });
      setMsg("Producto actualizado ✅");
      resetForm();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error guardando producto.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: ProductRow) => {
    setEditingId(product.id);
    setForm({
      name: product.name ?? "",
      price: String(product.price ?? ""),
      cost: product.cost != null ? String(product.cost) : "",
      category: product.category ?? "",
      sku: product.sku ?? "",
      isActive: product.isActive ?? true,
    });
  };

  const seedProducts = async () => {
    setSeedMsg("");
    setSeeding(true);
    try {
      const existingNames = new Set(products.map((p) => p.name.toLowerCase()));
      const categoryCounters: Record<string, number> = {};

      for (const item of seedCatalog) {
        if (existingNames.has(item.name.toLowerCase())) continue;

        const code = categoryCodeMap[item.category] ?? "GEN";
        const nextIndex = (categoryCounters[item.category] ?? 0) + 1;
        categoryCounters[item.category] = nextIndex;
        const sku = `LTR-${code}-${String(nextIndex).padStart(3, "0")}`;

        await createProduct({
          name: item.name,
          price: item.price,
          cost: item.cost,
          category: item.category,
          sku,
        });
      }

      setSeedMsg("Catálogo cargado ✅");
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "Error cargando catálogo.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Productos & costos</h1>
        <p style={{ opacity: 0.8 }}>
          Catálogo de venta con precios y costos.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: 18, padding: 16, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: 0 }}>{editingId ? "Editar producto" : "Nuevo producto"}</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Precio"
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Costo"
            value={form.cost}
            onChange={(e) => setForm((prev) => ({ ...prev, cost: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Categoría"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="SKU"
            value={form.sku}
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
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
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear producto"}
          </button>
          {editingId && (
            <button onClick={resetForm} disabled={saving} style={secondaryButton}>
              Cancelar
            </button>
          )}
        </div>

        {msg && <p style={{ color: msg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{msg}</p>}
      </div>

      <div style={{ border: "1px dashed var(--border)", borderRadius: 18, padding: 16, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ marginTop: 0 }}>Carga inicial</h3>
        <p style={{ opacity: 0.8, marginTop: 4 }}>
          Crea el catálogo base con categorías y SKU automáticos (LTR-XXX-###). Si un producto ya existe, se omite.
        </p>
        <button onClick={seedProducts} disabled={seeding} style={buttonStyle}>
          {seeding ? "Cargando..." : "Cargar catálogo base"}
        </button>
        {seedMsg && <p style={{ marginTop: 10, color: seedMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{seedMsg}</p>}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 18, padding: 16, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ marginTop: 0 }}>Listado</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : products.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No hay productos todavía.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {products.map((product) => (
              <div key={product.id} style={rowStyle}>
                <div>
                  <strong>{product.name}</strong>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    {product.category || "Sin categoría"} {product.sku ? `• SKU ${product.sku}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span>Precio: ${(product.price ?? 0).toLocaleString("es-CO")}</span>
                  <span style={{ opacity: 0.8 }}>{product.isActive ? "Activo" : "Inactivo"}</span>
                  <button onClick={() => startEdit(product)} style={secondaryButton}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontWeight: 700,
  background: "var(--accent)",
  color: "#0b0b0f",
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(255, 90, 95, 0.25)",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  cursor: "pointer",
  fontWeight: 600,
};

const rowStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  background: "var(--surface)",
};
