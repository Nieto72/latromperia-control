"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { expenseConverter, type WithId } from "../../lib/converters";
import type { ExpenseCategory, ExpenseDoc } from "../../lib/models";
import { createExpense } from "../../lib/repos/expenses";
import { useAuth } from "../../components/AuthProvider";

type ExpenseRow = WithId<ExpenseDoc>;

const categories: { value: ExpenseCategory; label: string }[] = [
  { value: "nomina", label: "Nómina" },
  { value: "arriendo", label: "Arriendo" },
  { value: "proveedores", label: "Proveedores" },
  { value: "insumos", label: "Insumos" },
  { value: "servicios", label: "Servicios / Recibos" },
  { value: "imprevistos", label: "Imprevistos" },
  { value: "extras", label: "Extras" },
];

const subcategoryOptions: Record<ExpenseCategory, string[]> = {
  nomina: [],
  arriendo: [],
  proveedores: ["Carnes", "Panadería", "Bebidas", "Verduras", "Lácteos", "Otros"],
  insumos: ["Empaques", "Desechables", "Limpieza", "Aceite", "Gas", "Otros"],
  servicios: ["Luz", "Agua", "Internet", "Datáfono", "Gas", "Otros"],
  imprevistos: ["Reparaciones", "Multas", "Equipo", "Otros"],
  extras: ["Retiro dueño", "Bonos", "Compras varias", "Otros"],
};

const providerCatalog = ["Proveedor carnes", "Proveedor panes", "Proveedor bebidas", "Proveedor verduras", "Proveedor lácteos", "Otro"];

type RangeKey = "today" | "week" | "month" | "custom";

type PayrollEmployee = {
  id: string;
  name: string;
  dailyPay: number;
};

const payrollEmployees: PayrollEmployee[] = [
  { id: "valentina", name: "Valentina", dailyPay: 40_000 },
  { id: "charlie", name: "Charlie", dailyPay: 60_000 },
];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [quickMsg, setQuickMsg] = useState("");
  const [payrollMsg, setPayrollMsg] = useState("");
  const [ownerMsg, setOwnerMsg] = useState("");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("nomina");
  const [subcategory, setSubcategory] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [note, setNote] = useState("");
  const [providerName, setProviderName] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toInputDate(tomorrow);
  });

  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [payrollDate, setPayrollDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toInputDate(tomorrow);
  });
  const [payrollSelection, setPayrollSelection] = useState<Record<string, boolean>>(() => {
    return payrollEmployees.reduce<Record<string, boolean>>((acc, emp) => {
      acc[emp.id] = false;
      return acc;
    }, {});
  });
  const [ownerDate, setOwnerDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toInputDate(tomorrow);
  });
  const [ownerAmount, setOwnerAmount] = useState("");

  const [monthKey, setMonthKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [daysOpen, setDaysOpen] = useState("26");
  const [foodCostPct, setFoodCostPct] = useState("35");
  const [rentMonthly, setRentMonthly] = useState("1000000");
  const [utilitiesMonthly, setUtilitiesMonthly] = useState("445000");
  const [payrollHigh, setPayrollHigh] = useState("100000");
  const [payrollLow, setPayrollLow] = useState("40000");
  const [payrollHighDays, setPayrollHighDays] = useState("3");
  const [payrollLowDays, setPayrollLowDays] = useState("3");

  const baseMonthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 10, 12, 0, 0, 0);
  }, []);

  useEffect(() => {
    const expensesCol = collection(db, "expenses").withConverter(expenseConverter);
    const qy = query(expensesCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setExpenses(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const rangeDates = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (range === "week") {
      start.setDate(start.getDate() - 6);
    } else if (range === "month") {
      start.setDate(start.getDate() - 29);
    } else if (range === "custom") {
      if (customFrom) {
        const from = new Date(customFrom);
        from.setHours(0, 0, 0, 0);
        start.setTime(from.getTime());
      }
      if (customTo) {
        const to = new Date(customTo);
        to.setHours(23, 59, 59, 999);
        end.setTime(to.getTime());
      }
    }

    return { start, end };
  }, [range, customFrom, customTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const date = exp.createdAt?.toDate?.();
      if (!date) return false;
      return date >= rangeDates.start && date <= rangeDates.end;
    });
  }, [expenses, rangeDates]);

  const total = useMemo(
    () => filteredExpenses.reduce((sum, exp) => sum + (exp.amount ?? 0), 0),
    [filteredExpenses]
  );

  const totalsByCategory = useMemo(() => {
    return filteredExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = exp.category ?? "otros";
      acc[key] = (acc[key] ?? 0) + (exp.amount ?? 0);
      return acc;
    }, {});
  }, [filteredExpenses]);

  const parseNumber = (value: string) => {
    const cleaned = value.replace(",", ".").trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const parseLocalDate = (value: string) => {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };

  const handleSubmit = async () => {
    setMsg("");
    setQuickMsg("");
    setPayrollMsg("");
    setOwnerMsg("");
    if (!user) {
      setMsg("No hay sesión activa.");
      return;
    }

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      setMsg("Describe el gasto.");
      return;
    }

    if (category === "nomina" && !employeeName.trim()) {
      setMsg("Pon el nombre del empleado.");
      return;
    }

    const amountValue = parseNumber(amount);
    if (amountValue === null || amountValue <= 0) {
      setMsg("Monto inválido.");
      return;
    }

    setSaving(true);
    try {
      const selectedDate = parseLocalDate(expenseDate) ?? new Date();
      await createExpense({
        description: cleanDesc,
        amount: amountValue,
        category,
        subcategory: subcategory.trim() || providerName.trim() || undefined,
        employeeName: employeeName.trim() || undefined,
        note: note.trim() || undefined,
        createdAt: selectedDate,
        createdBy: user.uid,
      });
      setDescription("");
      setAmount("");
      setSubcategory("");
      setEmployeeName("");
      setNote("");
      setProviderName("");
      setMsg("Gasto registrado ✅");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar el gasto.");
    } finally {
      setSaving(false);
    }
  };

  const registerQuickExpenses = async (type: "arriendo" | "recibos") => {
    setQuickMsg("");
    setPayrollMsg("");
    setOwnerMsg("");
    if (!user) {
      setQuickMsg("No hay sesión activa.");
      return;
    }

    setSaving(true);
    try {
      if (type === "arriendo") {
        await createExpense({
          description: "Arriendo mensual",
          amount: 1_000_000,
          category: "arriendo",
          note: "Pago base mensual",
          createdAt: baseMonthDate,
          createdBy: user.uid,
        });
      } else {
        const baseDate = new Date(baseMonthDate);
        await createExpense({
          description: "Recibo de luz",
          amount: 165_000,
          category: "servicios",
          subcategory: "Luz",
          createdAt: baseDate,
          createdBy: user.uid,
        });
        await createExpense({
          description: "Recibo de gas",
          amount: 200_000,
          category: "servicios",
          subcategory: "Gas",
          createdAt: baseDate,
          createdBy: user.uid,
        });
        await createExpense({
          description: "Recibo de agua",
          amount: 30_000,
          category: "servicios",
          subcategory: "Agua",
          createdAt: baseDate,
          createdBy: user.uid,
        });
        await createExpense({
          description: "Recibo de internet",
          amount: 50_000,
          category: "servicios",
          subcategory: "Internet",
          createdAt: baseDate,
          createdBy: user.uid,
        });
      }

      setQuickMsg("Registros guardados ✅");
    } catch (err) {
      setQuickMsg(err instanceof Error ? err.message : "No se pudieron guardar los registros.");
    } finally {
      setSaving(false);
    }
  };

  const registerPayroll = async () => {
    setPayrollMsg("");
    setMsg("");
    setQuickMsg("");
    setOwnerMsg("");
    if (!user) {
      setPayrollMsg("No hay sesión activa.");
      return;
    }

    const selected = payrollEmployees.filter((emp) => payrollSelection[emp.id]);
    if (selected.length === 0) {
      setPayrollMsg("Selecciona al menos un empleado.");
      return;
    }

    const selectedDate = parseLocalDate(payrollDate) ?? new Date();

    setSaving(true);
    try {
      for (const emp of selected) {
        await createExpense({
          description: "Pago diario",
          amount: emp.dailyPay,
          category: "nomina",
          employeeName: emp.name,
          createdAt: selectedDate,
          createdBy: user.uid,
        });
      }

      setPayrollSelection((prev) => {
        const next = { ...prev };
        payrollEmployees.forEach((emp) => {
          next[emp.id] = false;
        });
        return next;
      });
      setPayrollMsg("Nómina registrada ✅");
    } catch (err) {
      setPayrollMsg(err instanceof Error ? err.message : "No se pudo registrar la nómina.");
    } finally {
      setSaving(false);
    }
  };

  const registerOwnerWithdrawal = async () => {
    setOwnerMsg("");
    setMsg("");
    setQuickMsg("");
    setPayrollMsg("");
    if (!user) {
      setOwnerMsg("No hay sesión activa.");
      return;
    }

    const amountValue = parseNumber(ownerAmount);
    if (amountValue === null || amountValue <= 0) {
      setOwnerMsg("Monto inválido.");
      return;
    }

    const selectedDate = parseLocalDate(ownerDate) ?? new Date();

    setSaving(true);
    try {
      await createExpense({
        description: "Retiro dueño",
        amount: amountValue,
        category: "extras",
        subcategory: "Retiro dueño",
        createdAt: selectedDate,
        createdBy: user.uid,
      });
      setOwnerAmount("");
      setOwnerMsg("Retiro registrado ✅");
    } catch (err) {
      setOwnerMsg(err instanceof Error ? err.message : "No se pudo registrar el retiro.");
    } finally {
      setSaving(false);
    }
  };

  const monthRange = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) return null;
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }, [monthKey]);

  const monthExpenses = useMemo(() => {
    if (!monthRange) return [];
    return expenses.filter((exp) => {
      const date = exp.createdAt?.toDate?.();
      if (!date) return false;
      return date >= monthRange.start && date <= monthRange.end;
    });
  }, [expenses, monthRange]);

  const monthTotals = useMemo(() => {
    return monthExpenses.reduce<Record<string, number>>((acc, exp) => {
      const key = exp.category ?? "otros";
      acc[key] = (acc[key] ?? 0) + (exp.amount ?? 0);
      return acc;
    }, {});
  }, [monthExpenses]);

  const monthTotalAmount = useMemo(
    () => monthExpenses.reduce((sum, exp) => sum + (exp.amount ?? 0), 0),
    [monthExpenses]
  );

  const goals = useMemo(() => {
    const days = parseNumber(daysOpen) ?? 0;
    const foodPct = (parseNumber(foodCostPct) ?? 0) / 100;
    const rent = parseNumber(rentMonthly) ?? 0;
    const utilities = parseNumber(utilitiesMonthly) ?? 0;
    const highPay = parseNumber(payrollHigh) ?? 0;
    const lowPay = parseNumber(payrollLow) ?? 0;
    const highDays = parseNumber(payrollHighDays) ?? 0;
    const lowDays = parseNumber(payrollLowDays) ?? 0;
    const totalDaysWeek = highDays + lowDays;

    if (days <= 0 || foodPct <= 0 || foodPct >= 1 || totalDaysWeek <= 0) {
      return null;
    }

    const avgPayrollDay = (highPay * highDays + lowPay * lowDays) / totalDaysWeek;
    const payrollMonthly = avgPayrollDay * days;
    const fixedMonthly = rent + utilities + payrollMonthly;
    const breakevenMonthly = fixedMonthly / (1 - foodPct);
    const breakevenDaily = breakevenMonthly / days;
    const breakevenWeekly = breakevenDaily * totalDaysWeek;

    return {
      avgPayrollDay,
      payrollMonthly,
      fixedMonthly,
      breakevenMonthly,
      breakevenDaily,
      breakevenWeekly,
      totalDaysWeek,
      foodPct,
    };
  }, [
    daysOpen,
    foodCostPct,
    rentMonthly,
    utilitiesMonthly,
    payrollHigh,
    payrollLow,
    payrollHighDays,
    payrollLowDays,
  ]);

  const formatDate = (date?: Date | null) => {
    if (!date) return "-";
    return `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  return (
    <div style={{ padding: 24, display: "grid", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Gastos y pagos</h1>
        <p style={{ opacity: 0.8 }}>
          Registra nómina diaria por empleado, arriendo, proveedores, insumos, recibos e imprevistos.
        </p>
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Filtro por fecha</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { value: "today", label: "Hoy" },
            { value: "week", label: "Últimos 7 días" },
            { value: "month", label: "Últimos 30 días" },
            { value: "custom", label: "Personalizado" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value as RangeKey)}
              style={{
                ...secondaryButton,
                background: range === opt.value ? "white" : "transparent",
                color: range === opt.value ? "#000" : "inherit",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {range === "custom" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={inputStyle}
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Nuevo gasto</h3>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {category === "nomina" && (
            <input
              placeholder="Empleado"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} style={inputStyle}>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {(category === "proveedores" || category === "insumos") && (
            <select value={providerName} onChange={(e) => setProviderName(e.target.value)} style={inputStyle}>
              <option value="" disabled>
                Proveedor
              </option>
              {providerCatalog.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
          {subcategoryOptions[category].length > 0 && (
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} style={inputStyle}>
              <option value="" disabled>
                Subcategoría
              </option>
              {subcategoryOptions[category].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
          <input
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button onClick={handleSubmit} disabled={saving} style={buttonStyle}>
          {saving ? "Guardando..." : "Registrar gasto"}
        </button>
        {msg && <p style={{ color: msg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{msg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Nómina rápida</h3>
        <p style={{ opacity: 0.8 }}>
          Marca quién trabajó hoy y registra el pago diario con un clic.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {payrollEmployees.map((emp) => (
            <label key={emp.id} style={checkboxStyle}>
              <input
                type="checkbox"
                checked={payrollSelection[emp.id] ?? false}
                onChange={(e) =>
                  setPayrollSelection((prev) => ({ ...prev, [emp.id]: e.target.checked }))
                }
              />
              {emp.name} · ${emp.dailyPay.toLocaleString("es-CO")}
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="date"
            value={payrollDate}
            onChange={(e) => setPayrollDate(e.target.value)}
            style={inputStyle}
          />
          <button onClick={registerPayroll} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : "Registrar nómina"}
          </button>
        </div>
        {payrollMsg && <p style={{ color: payrollMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{payrollMsg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Retiro dueño</h3>
        <p style={{ opacity: 0.8 }}>
          Registra el dinero que retiras cuando trabajas para que la caja cuadre.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="date"
            value={ownerDate}
            onChange={(e) => setOwnerDate(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Monto"
            value={ownerAmount}
            onChange={(e) => setOwnerAmount(e.target.value)}
            style={inputStyle}
          />
          <button onClick={registerOwnerWithdrawal} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : "Registrar retiro"}
          </button>
        </div>
        {ownerMsg && <p style={{ color: ownerMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{ownerMsg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Accesos rápidos</h3>
        <p style={{ opacity: 0.8 }}>
          Carga el arriendo del mes (día 10) o los recibos base con un clic.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => registerQuickExpenses("arriendo")} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : "Cargar arriendo del mes"}
          </button>
          <button onClick={() => registerQuickExpenses("recibos")} disabled={saving} style={buttonStyle}>
            {saving ? "Guardando..." : "Cargar recibos del mes"}
          </button>
        </div>
        {quickMsg && <p style={{ color: quickMsg.includes("✅") ? "#7CFC00" : "#FF6B6B" }}>{quickMsg}</p>}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Resumen mensual</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            style={inputStyle}
          />
          <strong>Total mes: ${Math.round(monthTotalAmount).toLocaleString("es-CO")}</strong>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {categories.map((cat) => (
            <div key={cat.value} style={pillStyle}>
              {cat.label}: ${Math.round(monthTotals[cat.value] ?? 0).toLocaleString("es-CO")}
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Metas de venta</h3>
        <p style={{ opacity: 0.8 }}>
          Calcula cuánto debes vender para cubrir costos y empezar a ganar. Ajusta los valores si cambian.
        </p>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input
            placeholder="Días abiertos al mes"
            value={daysOpen}
            onChange={(e) => setDaysOpen(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Food cost %"
            value={foodCostPct}
            onChange={(e) => setFoodCostPct(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Arriendo mensual"
            value={rentMonthly}
            onChange={(e) => setRentMonthly(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Recibos mensuales"
            value={utilitiesMonthly}
            onChange={(e) => setUtilitiesMonthly(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Nómina alta (día)"
            value={payrollHigh}
            onChange={(e) => setPayrollHigh(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Días nómina alta/sem"
            value={payrollHighDays}
            onChange={(e) => setPayrollHighDays(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Nómina baja (día)"
            value={payrollLow}
            onChange={(e) => setPayrollLow(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Días nómina baja/sem"
            value={payrollLowDays}
            onChange={(e) => setPayrollLowDays(e.target.value)}
            style={inputStyle}
          />
        </div>
        {!goals ? (
          <p style={{ opacity: 0.8 }}>Completa los valores para ver el cálculo.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={pillStyle}>
              Nómina promedio/día: ${Math.round(goals.avgPayrollDay).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Nómina mensual: ${Math.round(goals.payrollMonthly).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Costos fijos + nómina: ${Math.round(goals.fixedMonthly).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Punto de equilibrio mensual: ${Math.round(goals.breakevenMonthly).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Punto de equilibrio diario: ${Math.round(goals.breakevenDaily).toLocaleString("es-CO")}
            </div>
            <div style={pillStyle}>
              Punto de equilibrio semanal ({goals.totalDaysWeek} días): $
              {Math.round(goals.breakevenWeekly).toLocaleString("es-CO")}
            </div>
          </div>
        )}
      </div>

      <div style={{ border: "1px solid #2a2a2a", borderRadius: 18, padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Historial</h3>
        <p style={{ opacity: 0.8 }}>Total registrado: ${total.toLocaleString("es-CO")}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {categories.map((cat) => (
            <div key={cat.value} style={pillStyle}>
              {cat.label}: ${Math.round(totalsByCategory[cat.value] ?? 0).toLocaleString("es-CO")}
            </div>
          ))}
        </div>
        {loading ? (
          <p>Cargando...</p>
        ) : filteredExpenses.length === 0 ? (
          <p style={{ opacity: 0.8 }}>No hay gastos todavía.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredExpenses.map((exp) => {
              const createdAt = exp.createdAt?.toDate?.() ?? null;
              return (
                <div key={exp.id} style={rowStyle}>
                  <div>
                    <strong>
                      {exp.category === "nomina" && exp.employeeName
                        ? `${exp.employeeName} — ${exp.description}`
                        : exp.description}
                    </strong>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {categories.find((c) => c.value === exp.category)?.label ?? exp.category}
                      {exp.subcategory ? ` · ${exp.subcategory}` : ""}
                      {" · "}
                      {formatDate(createdAt)}
                    </div>
                    {exp.note && <div style={{ opacity: 0.8 }}>{exp.note}</div>}
                  </div>
                  <div style={{ fontWeight: 700 }}>${exp.amount.toLocaleString("es-CO")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  width: "fit-content",
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

const pillStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #2a2a2a",
  fontSize: 12,
  opacity: 0.9,
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

const checkboxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid #2a2a2a",
  fontSize: 13,
};
