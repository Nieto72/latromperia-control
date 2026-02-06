"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import {
  ingredientConverter,
  productConverter,
  recipeConverter,
  saleConverter,
  type WithId,
} from "../../lib/converters";
import type { IngredientDoc, LineItem, ProductDoc, RecipeDoc, SaleDoc } from "../../lib/models";

type SaleRow = WithId<SaleDoc>;

type RangeKey = "today" | "week" | "month";

const rangeOptions: { value: RangeKey; label: string; days: number }[] = [
  { value: "today", label: "Hoy", days: 0 },
  { value: "week", label: "Últimos 7 días", days: 7 },
  { value: "month", label: "Últimos 30 días", days: 30 },
];

export default function ReportsPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState("");
  const [products, setProducts] = useState<WithId<ProductDoc>[]>([]);
  const [ingredients, setIngredients] = useState<WithId<IngredientDoc>[]>([]);
  const [recipes, setRecipes] = useState<WithId<RecipeDoc>[]>([]);

  const [daysOpen, setDaysOpen] = useState("26");
  const [daysOpenWeek, setDaysOpenWeek] = useState("6");
  const [fixedMonthly, setFixedMonthly] = useState("3205000");
  const [targetProfit, setTargetProfit] = useState("2000000");
  const [unitsPerDay, setUnitsPerDay] = useState("10");
  const [avgUnitPrice, setAvgUnitPrice] = useState("");

  const parseNumber = (value: string) => {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const rangeInfo = rangeOptions.find((opt) => opt.value === range) ?? rangeOptions[0];
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (rangeInfo.days > 0) {
        start.setDate(start.getDate() - rangeInfo.days);
      }

      const salesCol = collection(db, "sales").withConverter(saleConverter);
      const qy = query(salesCol, where("createdAt", ">=", start), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);
      setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };

    void fetchSales();
  }, [range]);

  useEffect(() => {
    const fetchCatalogs = async () => {
      const productsCol = collection(db, "products").withConverter(productConverter);
      const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
      const recipesCol = collection(db, "recipes").withConverter(recipeConverter);

      const [productsSnap, ingredientsSnap, recipesSnap] = await Promise.all([
        getDocs(productsCol),
        getDocs(ingredientsCol),
        getDocs(recipesCol),
      ]);

      setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIngredients(ingredientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setRecipes(recipesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    void fetchCatalogs();
  }, []);

  const cleanTodayTestData = async () => {
    setCleanMsg("");
    const ok = window.confirm(
      "¿Borrar pedidos y ventas de HOY? Esto no se puede deshacer."
    );
    if (!ok) return;

    setCleaning(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const ordersCol = collection(db, "orders");
      const salesCol = collection(db, "sales");
      const ordersSnap = await getDocs(query(ordersCol, where("createdAt", ">=", start)));
      const salesSnap = await getDocs(query(salesCol, where("createdAt", ">=", start)));

      for (const docSnap of ordersSnap.docs) {
        await deleteDoc(doc(db, "orders", docSnap.id));
      }
      for (const docSnap of salesSnap.docs) {
        await deleteDoc(doc(db, "sales", docSnap.id));
      }

      setCleanMsg("Datos de hoy eliminados ✅");
    } catch (err) {
      setCleanMsg(err instanceof Error ? err.message : "No se pudo limpiar.");
    } finally {
      setCleaning(false);
    }
  };

  const avgPriceGuess = useMemo(() => {
    if (products.length === 0) return 0;
    const burgerCandidates = products.filter((prod) => {
      const name = (prod.name ?? "").toLowerCase();
      const category = (prod.category ?? "").toLowerCase();
      return (
        category.includes("hamburg") ||
        name.includes("burger") ||
        name.includes("smash")
      );
    });
    const list = burgerCandidates.length > 0 ? burgerCandidates : products;
    const total = list.reduce((sum, prod) => sum + (prod.price ?? 0), 0);
    return list.length > 0 ? Math.round(total / list.length) : 0;
  }, [products]);

  useEffect(() => {
    if (!avgUnitPrice && avgPriceGuess > 0) {
      setAvgUnitPrice(String(avgPriceGuess));
    }
  }, [avgPriceGuess, avgUnitPrice]);

  const totals = useMemo(() => {
    const totalSales = sales.reduce((sum, sale) => sum + (sale.total ?? 0), 0);
    const ticketCount = sales.length;
    const average = ticketCount > 0 ? totalSales / ticketCount : 0;
    return { totalSales, ticketCount, average };
  }, [sales]);

  const recipeCostInfo = useMemo(() => {
    const ingredientCost = new Map<string, number>();
    const missingIngredientCost = new Set<string>();
    ingredients.forEach((ing) => {
      if (typeof ing.costPerUnit === "number") {
        ingredientCost.set(ing.id, ing.costPerUnit);
      } else {
        missingIngredientCost.add(ing.id);
      }
    });

    const costByProduct = new Map<string, number>();
    const missingRecipeForProduct = new Set<string>();
    const missingCostForRecipe = new Set<string>();

    recipes.forEach((recipe) => {
      let cost = 0;
      let missing = false;
      for (const item of recipe.items ?? []) {
        const ingredientUnitCost = ingredientCost.get(item.ingredientId);
        if (typeof ingredientUnitCost !== "number") {
          missing = true;
        } else {
          cost += ingredientUnitCost * item.qty;
        }
      }
      if (missing) {
        missingCostForRecipe.add(recipe.productId);
      } else {
        costByProduct.set(recipe.productId, cost);
      }
    });

    products.forEach((prod) => {
      if (!costByProduct.has(prod.id)) {
        missingRecipeForProduct.add(prod.id);
      }
    });

    return {
      costByProduct,
      missingIngredientCost,
      missingRecipeForProduct,
      missingCostForRecipe,
    };
  }, [ingredients, products, recipes]);

  const foodCostStats = useMemo(() => {
    let totalCost = 0;
    let totalRevenue = 0;
    let missingCostItems = 0;

    const addItems = (items: LineItem[]) => {
      for (const item of items) {
        totalRevenue += item.qty * item.price;
        const cost = recipeCostInfo.costByProduct.get(item.id);
        if (typeof cost === "number") {
          totalCost += cost * item.qty;
        } else {
          missingCostItems += 1;
        }
      }
    };

    sales.forEach((sale) => {
      addItems(sale.items ?? []);
      addItems(sale.additions ?? []);
    });

    const foodCostPct = totalRevenue > 0 ? totalCost / totalRevenue : 0;
    const grossProfit = totalRevenue - totalCost;

    return {
      totalCost,
      totalRevenue,
      foodCostPct,
      grossProfit,
      missingCostItems,
    };
  }, [sales, recipeCostInfo.costByProduct]);

  const effectiveFoodCostPct = foodCostStats.foodCostPct > 0 ? foodCostStats.foodCostPct : 0.35;

  const productStats = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    const addItems = (items: LineItem[]) => {
      for (const item of items) {
        const existing = map.get(item.id) ?? { name: item.name, qty: 0, revenue: 0 };
        existing.qty += item.qty;
        existing.revenue += item.qty * item.price;
        map.set(item.id, existing);
      }
    };

    sales.forEach((sale) => {
      addItems(sale.items ?? []);
      addItems(sale.additions ?? []);
    });

    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales]);

  const dayStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const sale of sales) {
      const date = sale.createdAt?.toDate?.();
      if (!date) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += sale.total ?? 0;
      entry.count += 1;
      map.set(key, entry);
    }

    return Array.from(map.entries())
      .map(([key, value]) => ({ date: key, ...value }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [sales]);

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const sale of sales) {
      const date = sale.createdAt?.toDate?.();
      if (!date) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + (sale.total ?? 0));
    }

    return Array.from(map.entries())
      .map(([key, total]) => ({ date: key, total }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  const salesGoal = useMemo(() => {
    const days = parseNumber(daysOpen) ?? 0;
    const daysWeek = parseNumber(daysOpenWeek) ?? 0;
    const fixed = parseNumber(fixedMonthly) ?? 0;
    const target = parseNumber(targetProfit) ?? 0;
    const foodPct = effectiveFoodCostPct;

    if (days <= 0 || daysWeek <= 0 || foodPct <= 0 || foodPct >= 1) return null;

    const requiredMonthly = (fixed + target) / (1 - foodPct);
    const requiredDaily = requiredMonthly / days;
    const requiredWeekly = requiredDaily * daysWeek;

    return { requiredMonthly, requiredDaily, requiredWeekly };
  }, [daysOpen, daysOpenWeek, fixedMonthly, targetProfit, effectiveFoodCostPct]);

  const unitGoal = useMemo(() => {
    const units = parseNumber(unitsPerDay) ?? 0;
    const price = parseNumber(avgUnitPrice) ?? 0;
    if (units <= 0 || price <= 0) return null;
    return {
      dailyRevenue: units * price,
      weeklyRevenue: units * price * (parseNumber(daysOpenWeek) ?? 0),
      monthlyRevenue: units * price * (parseNumber(daysOpen) ?? 0),
    };
  }, [unitsPerDay, avgUnitPrice, daysOpen, daysOpenWeek]);

  const maxDaily = dailyTotals.reduce((max, item) => Math.max(max, item.total), 0);

  const formatDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    return date.toLocaleDateString("es-CO");
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Reportes de ventas</h1>
        <p style={{ opacity: 0.8 }}>Productos top, días top y tickets digitales.</p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {rangeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setRange(option.value)}
            style={{
              ...buttonStyle,
              background: range === option.value ? "white" : "transparent",
              color: range === option.value ? "#000" : "inherit",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Pruebas (temporal)</h3>
        <p style={{ opacity: 0.8 }}>
          Borra pedidos y ventas creados hoy mientras haces pruebas.
        </p>
        <button onClick={cleanTodayTestData} disabled={cleaning} style={buttonStyle}>
          {cleaning ? "Borrando..." : "Limpiar pruebas de hoy"}
        </button>
        {cleanMsg && <p style={{ opacity: 0.8 }}>{cleanMsg}</p>}
      </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div style={cardStyle}>
          <p style={{ opacity: 0.7, margin: 0 }}>Ventas</p>
          <h3 style={{ margin: "6px 0 0" }}>${totals.totalSales.toLocaleString("es-CO")}</h3>
        </div>
        <div style={cardStyle}>
          <p style={{ opacity: 0.7, margin: 0 }}>Tickets</p>
          <h3 style={{ margin: "6px 0 0" }}>{totals.ticketCount}</h3>
        </div>
        <div style={cardStyle}>
          <p style={{ opacity: 0.7, margin: 0 }}>Ticket promedio</p>
          <h3 style={{ margin: "6px 0 0" }}>${Math.round(totals.average).toLocaleString("es-CO")}</h3>
        </div>
        <div style={cardStyle}>
          <p style={{ opacity: 0.7, margin: 0 }}>Food cost real</p>
          <h3 style={{ margin: "6px 0 0" }}>
            {(foodCostStats.foodCostPct * 100).toFixed(1)}%
          </h3>
          <p style={{ opacity: 0.7, margin: "6px 0 0" }}>
            Costo: ${Math.round(foodCostStats.totalCost).toLocaleString("es-CO")}
          </p>
          <p style={{ opacity: 0.7, margin: 0 }}>
            Margen bruto: ${Math.round(foodCostStats.grossProfit).toLocaleString("es-CO")}
          </p>
        </div>
      </div>

      {foodCostStats.foodCostPct === 0 && (
        <div style={warningStyle}>
          <strong>Nota:</strong> Sin ventas en el rango. Para las metas se usa un food cost
          estimado del 35% hasta tener ventas reales.
        </div>
      )}

      {(recipeCostInfo.missingCostForRecipe.size > 0 ||
        recipeCostInfo.missingRecipeForProduct.size > 0 ||
        foodCostStats.missingCostItems > 0) && (
        <div style={warningStyle}>
          <strong>Atención:</strong> Hay productos sin receta o ingredientes sin costo. El food cost
          puede estar subestimado.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Productos más vendidos</h3>
          {loading ? (
            <p>Cargando...</p>
          ) : productStats.length === 0 ? (
            <p style={{ opacity: 0.8 }}>Sin ventas en el rango.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {productStats.map((prod) => (
                <div key={prod.name} style={rowStyle}>
                  <span>{prod.name}</span>
                  <span>
                    {prod.qty} u · ${Math.round(prod.revenue).toLocaleString("es-CO")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Días más vendidos</h3>
          {loading ? (
            <p>Cargando...</p>
          ) : dayStats.length === 0 ? (
            <p style={{ opacity: 0.8 }}>Sin ventas en el rango.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {dayStats.map((day) => (
                <div key={day.date} style={rowStyle}>
                  <span>{formatDate(day.date)}</span>
                  <span>
                    ${Math.round(day.total).toLocaleString("es-CO")} · {day.count} tickets
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Ventas por día</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : dailyTotals.length === 0 ? (
          <p style={{ opacity: 0.8 }}>Sin ventas en el rango.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {dailyTotals.map((day) => (
              <div key={day.date} style={barRow}>
                <span style={{ minWidth: 110 }}>{formatDate(day.date)}</span>
                <div style={barWrap}>
                  <div style={{ ...barFill, width: `${maxDaily > 0 ? (day.total / maxDaily) * 100 : 0}%` }} />
                </div>
                <strong>${Math.round(day.total).toLocaleString("es-CO")}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Meta de ventas (punto de equilibrio + ganancia)</h3>
        <p style={{ opacity: 0.8 }}>
          Usa el food cost real para calcular cuánto debes vender para cubrir todo y empezar a ganar.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input
            placeholder="Días abiertos/mes"
            value={daysOpen}
            onChange={(e) => setDaysOpen(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Días abiertos/sem"
            value={daysOpenWeek}
            onChange={(e) => setDaysOpenWeek(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Costos fijos mensuales"
            value={fixedMonthly}
            onChange={(e) => setFixedMonthly(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Meta de ganancia mensual"
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
            style={inputStyle}
          />
        </div>
        {!salesGoal ? (
          <p style={{ opacity: 0.8 }}>Completa los valores para ver el cálculo.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={pillStyle}>
              Meta mensual: ${Math.round(salesGoal.requiredMonthly).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Meta semanal: ${Math.round(salesGoal.requiredWeekly).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Meta diaria: ${Math.round(salesGoal.requiredDaily).toLocaleString("es-CO")}
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Meta diaria por unidades</h3>
        <p style={{ opacity: 0.8 }}>
          Ejemplo: 10 hamburguesas al día. Ajusta el precio promedio si cambia.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input
            placeholder="Unidades por día"
            value={unitsPerDay}
            onChange={(e) => setUnitsPerDay(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Precio promedio"
            value={avgUnitPrice}
            onChange={(e) => setAvgUnitPrice(e.target.value)}
            style={inputStyle}
          />
        </div>
        {!unitGoal ? (
          <p style={{ opacity: 0.8 }}>Completa los valores para ver la meta.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={pillStyle}>
              Venta diaria estimada: ${Math.round(unitGoal.dailyRevenue).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Venta semanal estimada: ${Math.round(unitGoal.weeklyRevenue).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Venta mensual estimada: ${Math.round(unitGoal.monthlyRevenue).toLocaleString("es-CO")}
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Tickets digitales</h3>
        {loading ? (
          <p>Cargando...</p>
        ) : sales.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No hay tickets en el rango.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sales.map((sale) => {
              const createdAt = sale.createdAt?.toDate?.();
              return (
                <div key={sale.id} style={ticketRow}>
                  <div>
                    <strong>#{sale.ticketNumber}</strong> · {sale.label}
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {createdAt ? createdAt.toLocaleString("es-CO") : "-"} · {sale.payMethod}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700 }}>${sale.total.toLocaleString("es-CO")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #333",
  fontWeight: 700,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 18,
  padding: 16,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
};

const ticketRow: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: "1px solid #333",
  background: "transparent",
  color: "inherit",
};

const pillStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #2a2a2a",
  fontSize: 12,
  opacity: 0.9,
};

const warningStyle: React.CSSProperties = {
  border: "1px solid #6b3b3b",
  background: "rgba(255, 107, 107, 0.12)",
  borderRadius: 14,
  padding: 12,
};

const barRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 120px",
  gap: 10,
  alignItems: "center",
};

const barWrap: React.CSSProperties = {
  height: 8,
  background: "#1f1f1f",
  borderRadius: 999,
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #7CFC00, #00d4ff)",
};
