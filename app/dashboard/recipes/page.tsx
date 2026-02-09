"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { ingredientConverter, productConverter, recipeConverter, type WithId } from "../../lib/converters";
import type { IngredientDoc, ProductDoc, RecipeDoc, RecipeItem } from "../../lib/models";

type ProductRow = WithId<ProductDoc>;
type IngredientRow = WithId<IngredientDoc>;

type SeedRecipe = {
  product: string;
  items: { ingredient: string; qty: number }[];
};

const seedRecipes: SeedRecipe[] = [
  {
    product: "Smash Burger",
    items: [
      { ingredient: "Carne smash bola 65g", qty: 2 },
      { ingredient: "Pan brioche", qty: 1 },
      { ingredient: "Queso loncha", qty: 2 },
      { ingredient: "Salsa burger galon", qty: 2 },
      { ingredient: "Salsa tocineta ahumada galon", qty: 2 },
      { ingredient: "Vegetales mixtos", qty: 1 },
      { ingredient: "Pepinillos galon", qty: 1 },
      { ingredient: "Cebolla crispy 1000g", qty: 1 },
      { ingredient: "Tomate", qty: 1 },
      { ingredient: "Cebolla", qty: 0.125 },
    ],
  },
  {
    product: "Smash Americana",
    items: [
      { ingredient: "Carne smash bola 65g", qty: 2 },
      { ingredient: "Pan brioche", qty: 1 },
      { ingredient: "Queso loncha", qty: 2 },
      { ingredient: "Tocineta", qty: 1 },
      { ingredient: "Salsa burger galon", qty: 2 },
      { ingredient: "Vegetales mixtos", qty: 1 },
      { ingredient: "Pepinillos galon", qty: 1 },
      { ingredient: "Cebolla crispy 1000g", qty: 1 },
      { ingredient: "Tomate", qty: 1 },
      { ingredient: "Cebolla", qty: 0.125 },
    ],
  },
  {
    product: "La Chingona",
    items: [
      { ingredient: "Carne smash bola 65g", qty: 2 },
      { ingredient: "Pan brioche", qty: 1 },
      { ingredient: "Queso loncha", qty: 2 },
      { ingredient: "Takis bolsa", qty: 1 },
      { ingredient: "Jalapeños galon", qty: 1 },
      { ingredient: "Crema agria 185gr", qty: 1 },
      { ingredient: "Sriracha reducida galon", qty: 1 },
      { ingredient: "Vegetales mixtos", qty: 1 },
      { ingredient: "Tomate", qty: 1 },
      { ingredient: "Cebolla", qty: 0.125 },
    ],
  },
  {
    product: "La Irresponsable",
    items: [
      { ingredient: "Carne smash bola 65g", qty: 4 },
      { ingredient: "Pan brioche", qty: 1 },
      { ingredient: "Queso loncha", qty: 4 },
      { ingredient: "Tocineta", qty: 1 },
      { ingredient: "Salsa burger galon", qty: 1 },
      { ingredient: "Salsa tocineta ahumada galon", qty: 1 },
      { ingredient: "Vegetales mixtos", qty: 1 },
      { ingredient: "Pepinillos galon", qty: 1 },
      { ingredient: "Cebolla crispy 1000g", qty: 1 },
      { ingredient: "Tomate", qty: 1 },
      { ingredient: "Cebolla", qty: 0.125 },
    ],
  },
  {
    product: "Papas Francesa",
    items: [{ ingredient: "Papas francesa cruda", qty: 1 }],
  },
  {
    product: "Papas Criollas",
    items: [{ ingredient: "Papas criollas cruda", qty: 1 }],
  },
  {
    product: "Coca Cola",
    items: [{ ingredient: "Coca Cola", qty: 1 }],
  },
  {
    product: "Coca Cola Zero",
    items: [{ ingredient: "Coca Cola Zero", qty: 1 }],
  },
  {
    product: "Quatro",
    items: [{ ingredient: "Quatro", qty: 1 }],
  },
  {
    product: "Sprite",
    items: [{ ingredient: "Sprite", qty: 1 }],
  },
  {
    product: "Kola Roman",
    items: [{ ingredient: "Kola Roman", qty: 1 }],
  },
  {
    product: "Ginger",
    items: [{ ingredient: "Ginger", qty: 1 }],
  },
  {
    product: "Soda",
    items: [{ ingredient: "Soda", qty: 1 }],
  },
  {
    product: "Agua",
    items: [{ ingredient: "Agua", qty: 1 }],
  },
  {
    product: "Agua con gas",
    items: [{ ingredient: "Agua con gas", qty: 1 }],
  },
  {
    product: "Queso",
    items: [{ ingredient: "Queso loncha", qty: 1 }],
  },
  {
    product: "Tocineta",
    items: [{ ingredient: "Tocineta", qty: 1 }],
  },
  {
    product: "Pepinillos",
    items: [{ ingredient: "Pepinillos galon", qty: 1 }],
  },
  {
    product: "Jalapeños",
    items: [{ ingredient: "Jalapeños galon", qty: 1 }],
  },
];

export default function RecipesPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeCreatedAt, setRecipeCreatedAt] = useState<RecipeDoc["createdAt"]>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const [ingredientId, setIngredientId] = useState("");
  const [qty, setQty] = useState("");

  useEffect(() => {
    const productsCol = collection(db, "products").withConverter(productConverter);
    const productsQuery = query(productsCol, orderBy("name", "asc"));
    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
    const ingredientsQuery = query(ingredientsCol, orderBy("name", "asc"));
    const unsubIngredients = onSnapshot(ingredientsQuery, (snap) => {
      setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubProducts();
      unsubIngredients();
    };
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setRecipeItems([]);
      setRecipeCreatedAt(null);
      return;
    }

    setLoadingRecipe(true);
    const recipesCol = collection(db, "recipes").withConverter(recipeConverter);
    const recipeRef = doc(recipesCol, selectedProductId);
    const unsub = onSnapshot(recipeRef, (snap) => {
      if (!snap.exists()) {
        setRecipeItems([]);
        setRecipeCreatedAt(null);
        setLoadingRecipe(false);
        return;
      }

      const data = snap.data();
      setRecipeItems(data.items ?? []);
      setRecipeCreatedAt(data.createdAt ?? null);
      setLoadingRecipe(false);
    });

    return () => unsub();
  }, [selectedProductId]);

  const ingredientMap = useMemo(() => {
    return ingredients.reduce<Record<string, IngredientRow>>((acc, ingredient) => {
      acc[ingredient.id] = ingredient;
      return acc;
    }, {});
  }, [ingredients]);

  const productMap = useMemo(() => {
    return products.reduce<Record<string, ProductRow>>((acc, product) => {
      acc[product.name.toLowerCase()] = product;
      return acc;
    }, {});
  }, [products]);

  const ingredientNameMap = useMemo(() => {
    return ingredients.reduce<Record<string, IngredientRow>>((acc, ingredient) => {
      acc[ingredient.name.toLowerCase()] = ingredient;
      return acc;
    }, {});
  }, [ingredients]);

  const parseNumber = (value: string) => {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const addItem = () => {
    setMsg("");
    if (!ingredientId) {
      setMsg("Selecciona un ingrediente.");
      return;
    }
    const qtyValue = parseNumber(qty);
    if (qtyValue === null || qtyValue <= 0) {
      setMsg("Cantidad inválida.");
      return;
    }

    setRecipeItems((prev) => {
      const existing = prev.find((item) => item.ingredientId === ingredientId);
      if (existing) {
        return prev.map((item) =>
          item.ingredientId === ingredientId ? { ...item, qty: qtyValue } : item
        );
      }
      return [...prev, { ingredientId, qty: qtyValue }];
    });
    setQty("");
  };

  const removeItem = (id: string) => {
    setRecipeItems((prev) => prev.filter((item) => item.ingredientId !== id));
  };

  const saveRecipe = async () => {
    setMsg("");
    if (!selectedProductId) {
      setMsg("Selecciona un producto.");
      return;
    }
    if (recipeItems.length === 0) {
      setMsg("Agrega al menos un ingrediente.");
      return;
    }

    setSaving(true);
    try {
      const recipesCol = collection(db, "recipes").withConverter(recipeConverter);
      const recipeRef = doc(recipesCol, selectedProductId);
      const now = serverTimestamp();
      await setDoc(
        recipeRef,
        {
          productId: selectedProductId,
          items: recipeItems,
          createdAt: recipeCreatedAt ?? now,
          updatedAt: now,
        },
        { merge: true }
      );
      setMsg("Receta guardada ✅");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar la receta.");
    } finally {
      setSaving(false);
    }
  };

  const seedBaseRecipes = async () => {
    setSeedMsg("");
    setSeeding(true);
    try {
      const recipesCol = collection(db, "recipes").withConverter(recipeConverter);
      const now = serverTimestamp();
      const missing: string[] = [];

      for (const seed of seedRecipes) {
        const product = productMap[seed.product.toLowerCase()];
        if (!product) {
          missing.push(`Producto: ${seed.product}`);
          continue;
        }

        const items: RecipeItem[] = [];
        for (const entry of seed.items) {
          const ingredient = ingredientNameMap[entry.ingredient.toLowerCase()];
          if (!ingredient) {
            missing.push(`Ingrediente: ${entry.ingredient}`);
            continue;
          }
          items.push({ ingredientId: ingredient.id, qty: entry.qty });
        }

        if (items.length === 0) continue;

        const recipeRef = doc(recipesCol, product.id);
        await setDoc(recipeRef, {
          productId: product.id,
          items,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (missing.length > 0) {
        setSeedMsg(`Recetas cargadas con pendientes: ${missing.join(" | ")}`);
      } else {
        setSeedMsg("Recetas base cargadas ✅");
      }
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "No se pudo cargar recetas.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Recetas</h1>
        <p style={{ opacity: 0.8 }}>
          Define qué ingredientes consume cada producto del menú.
        </p>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 18, padding: 16, display: "grid", gap: 12, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: 0 }}>Selecciona un producto</h3>
        <select
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          style={inputStyle}
        >
          <option value="" disabled>
            Selecciona un producto
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 18, padding: 16, display: "grid", gap: 12, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: 0 }}>Ingredientes</h3>
        {loadingRecipe ? (
          <p>Cargando receta...</p>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} style={inputStyle}>
                <option value="" disabled>
                  Selecciona un ingrediente
                </option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Cantidad por unidad vendida"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={inputStyle}
              />
              <button onClick={addItem} style={buttonStyle}>
                Agregar
              </button>
            </div>

            {recipeItems.length === 0 ? (
              <p style={{ opacity: 0.8 }}>Sin ingredientes aún.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recipeItems.map((item) => {
                  const ingredient = ingredientMap[item.ingredientId];
                  return (
                    <div key={item.ingredientId} style={rowStyle}>
                      <span>
                        {ingredient?.name ?? "Ingrediente"} · {item.qty}{" "}
                        {ingredient?.unit ?? ""}
                      </span>
                      <button onClick={() => removeItem(item.ingredientId)} style={secondaryButton}>
                        Quitar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={saveRecipe} disabled={saving} style={buttonStyle}>
                {saving ? "Guardando..." : "Guardar receta"}
              </button>
            </div>
            {msg && <p style={{ color: msg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{msg}</p>}
          </>
        )}
      </div>

      <div style={{ border: "1px dashed var(--border)", borderRadius: 18, padding: 16, background: "var(--card)", boxShadow: "0 16px 40px rgba(0,0,0,0.25)" }}>
        <h3 style={{ marginTop: 0 }}>Carga inicial</h3>
        <p style={{ opacity: 0.8, marginTop: 4 }}>
          Carga recetas base para el menú actual. Si algo falta, se mostrará en el mensaje.
        </p>
        <button onClick={seedBaseRecipes} disabled={seeding} style={buttonStyle}>
          {seeding ? "Cargando..." : "Cargar recetas base"}
        </button>
        {seedMsg && <p style={{ marginTop: 10, color: seedMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{seedMsg}</p>}
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
  width: "fit-content",
  boxShadow: "0 12px 24px rgba(255, 90, 95, 0.25)",
};

const secondaryButton: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 10,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  background: "var(--surface)",
};
