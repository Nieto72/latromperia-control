"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  expenseConverter,
  ingredientConverter,
  recipeConverter,
  saleConverter,
  type WithId,
} from "../lib/converters";
import type { ExpenseDoc, IngredientDoc, RecipeDoc, SaleDoc } from "../lib/models";

const DAYS_OPEN = 26;
const TARGET_PROFIT = 2_000_000;
const FALLBACK_FOOD_COST = 0.35;
const FALLBACK_FIXED_MONTHLY = 3_205_000;

export default function DashboardPage() {
  const [foodCostPct, setFoodCostPct] = useState(0);
  const [fixedMonthly, setFixedMonthly] = useState(0);
  const [fallbackNote, setFallbackNote] = useState("");

  useEffect(() => {
    const fetchMetrics = async () => {
      const now = new Date();
      const salesStart = new Date();
      salesStart.setDate(salesStart.getDate() - 29);
      salesStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

      const salesCol = collection(db, "sales").withConverter(saleConverter);
      const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
      const recipesCol = collection(db, "recipes").withConverter(recipeConverter);
      const expensesCol = collection(db, "expenses").withConverter(expenseConverter);

      const [salesSnap, ingredientsSnap, recipesSnap, expensesSnap] = await Promise.all([
        getDocs(query(salesCol, where("createdAt", ">=", salesStart), orderBy("createdAt", "desc"))),
        getDocs(ingredientsCol),
        getDocs(recipesCol),
        getDocs(query(expensesCol, where("createdAt", ">=", monthStart), orderBy("createdAt", "desc"))),
      ]);

      const sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as WithId<SaleDoc>[];
      const ingredients = ingredientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as WithId<IngredientDoc>[];
      const recipes = recipesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as WithId<RecipeDoc>[];
      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as WithId<ExpenseDoc>[];

      const ingredientCost = new Map<string, number>();
      ingredients.forEach((ing) => {
        if (typeof ing.costPerUnit === "number") {
          ingredientCost.set(ing.id, ing.costPerUnit);
        }
      });

      const costByProduct = new Map<string, number>();
      recipes.forEach((recipe) => {
        let cost = 0;
        let missing = false;
        for (const item of recipe.items ?? []) {
          const unitCost = ingredientCost.get(item.ingredientId);
          if (typeof unitCost !== "number") {
            missing = true;
          } else {
            cost += unitCost * item.qty;
          }
        }
        if (!missing) {
          costByProduct.set(recipe.productId, cost);
        }
      });

      let totalRevenue = 0;
      let totalCost = 0;
      for (const sale of sales) {
        for (const item of sale.items ?? []) {
          totalRevenue += item.qty * item.price;
          const cost = costByProduct.get(item.id);
          if (typeof cost === "number") totalCost += cost * item.qty;
        }
        for (const item of sale.additions ?? []) {
          totalRevenue += item.qty * item.price;
          const cost = costByProduct.get(item.id);
          if (typeof cost === "number") totalCost += cost * item.qty;
        }
      }

      const computedFoodCost = totalRevenue > 0 ? totalCost / totalRevenue : 0;
      setFoodCostPct(computedFoodCost);

      const fixed = expenses.reduce((sum, exp) => {
        if (exp.category === "arriendo" || exp.category === "servicios" || exp.category === "nomina") {
          return sum + (exp.amount ?? 0);
        }
        return sum;
      }, 0);

      setFixedMonthly(fixed);

      if (computedFoodCost === 0 && fixed === 0) {
        setFallbackNote("Usando valores estimados: food cost 35% y costos fijos base.");
      } else if (computedFoodCost === 0) {
        setFallbackNote("Sin ventas recientes: food cost estimado 35%.");
      } else if (fixed === 0) {
        setFallbackNote("Sin gastos registrados este mes: usando costos fijos base.");
      } else {
        setFallbackNote("");
      }
    };

    void fetchMetrics();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>Dashboard — Admin</h1>
      <p style={{ opacity: 0.8, marginBottom: 20 }}>Panel principal del negocio</p>

      <GoalCard
        foodCostPct={foodCostPct}
        fixedMonthly={fixedMonthly}
        fallbackNote={fallbackNote}
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/dashboard/users" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Usuarios</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Activar / desactivar cajera, roles
          </p>
        </Link>

        <Link href="/dashboard/ingredients" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Ingredientes</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Stock real, mínimos y costos
          </p>
        </Link>

        <Link href="/dashboard/inventory" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Inventario</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Entradas, salidas, conteos
          </p>
        </Link>

        <Link href="/dashboard/products" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Productos & costos</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Márgenes por producto
          </p>
        </Link>

        <Link href="/dashboard/recipes" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Recetas</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Insumos por producto
          </p>
        </Link>

        <Link href="/dashboard/expenses" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Gastos</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Nómina, proveedores, extras
          </p>
        </Link>

        <Link href="/dashboard/reports" style={cardStyle}>
          <h3 style={{ margin: 0 }}>Reportes</h3>
          <p style={{ margin: "8px 0 0", opacity: 0.8 }}>
            Tickets, top productos y días
          </p>
        </Link>
      </div>
    </div>
  );
}

function GoalCard({
  foodCostPct,
  fixedMonthly,
  fallbackNote,
}: {
  foodCostPct: number;
  fixedMonthly: number;
  fallbackNote: string;
}) {
  const effectiveFoodCost = foodCostPct > 0 ? foodCostPct : FALLBACK_FOOD_COST;
  const effectiveFixed = fixedMonthly > 0 ? fixedMonthly : FALLBACK_FIXED_MONTHLY;
  const breakEvenMonthly = effectiveFixed / (1 - effectiveFoodCost);
  const profitMonthly = (effectiveFixed + TARGET_PROFIT) / (1 - effectiveFoodCost);
  const breakEvenDaily = Math.round(breakEvenMonthly / DAYS_OPEN);
  const profitDaily = Math.round(profitMonthly / DAYS_OPEN);

  return (
    <div style={goalCardStyle}>
      <div>
        <h2 style={{ margin: 0 }}>Meta diaria (admin)</h2>
        <p style={{ opacity: 0.8, margin: "6px 0 0" }}>
          Basada en food cost real y gastos registrados.
        </p>
        {fallbackNote && (
          <p style={{ opacity: 0.7, margin: "6px 0 0", fontSize: 12 }}>{fallbackNote}</p>
        )}
      </div>
      <div style={{ display: "grid", gap: 6, textAlign: "right" }}>
        <div>
          Equilibrio: <strong>${breakEvenDaily.toLocaleString("es-CO")}</strong>
        </div>
        <div>
          Ganancia $2M/mes: <strong>${profitDaily.toLocaleString("es-CO")}</strong>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "block",
  width: 280,
  padding: 16,
  borderRadius: 18,
  border: "1px solid var(--border)",
  background: "var(--card)",
  textDecoration: "none",
};

const goalCardStyle: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 16,
  marginBottom: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  background: "linear-gradient(135deg, rgba(255, 90, 95, 0.15), rgba(255, 209, 102, 0.12))",
};
