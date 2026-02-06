import { collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ingredientConverter, inventoryConverter } from "../converters";
import type { IngredientDoc, IngredientUnit, InventoryMovementType } from "../models";

type CreateIngredientInput = {
  name: string;
  unit: IngredientUnit;
  category?: string;
  costPerUnit?: number;
  minStock?: number;
};

type UpdateIngredientInput = Partial<Omit<IngredientDoc, "createdAt" | "updatedAt">>;

type InventoryMovementInput = {
  ingredientId: string;
  qty: number;
  type: InventoryMovementType;
  note?: string;
  createdBy: string;
};

export async function createIngredient(input: CreateIngredientInput): Promise<void> {
  const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
  const ingredientRef = doc(ingredientsCol);

  const now = serverTimestamp();

  await setDoc(ingredientRef, {
    name: input.name.trim(),
    unit: input.unit,
    category: input.category ?? "",
    costPerUnit: input.costPerUnit ?? undefined,
    minStock: input.minStock ?? 0,
    stock: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateIngredient(ingredientId: string, patch: UpdateIngredientInput): Promise<void> {
  const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
  const ingredientRef = doc(ingredientsCol, ingredientId);
  const sanitized = Object.entries(patch).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {});
  await updateDoc(ingredientRef, { ...sanitized, updatedAt: serverTimestamp() });
}

export async function addInventoryMovement(input: InventoryMovementInput): Promise<void> {
  const ingredientsCol = collection(db, "ingredients").withConverter(ingredientConverter);
  const inventoryCol = collection(db, "inventory").withConverter(inventoryConverter);
  const ingredientRef = doc(ingredientsCol, input.ingredientId);
  const movementRef = doc(inventoryCol);

  await runTransaction(db, async (tx) => {
    const ingredientSnap = await tx.get(ingredientRef);
    if (!ingredientSnap.exists()) {
      throw new Error("Ingrediente no encontrado");
    }

    const ingredient = ingredientSnap.data();
    const currentStock = ingredient.stock ?? 0;
    const qty = input.qty;

    const delta =
      input.type === "in" ? qty : input.type === "out" ? -qty : qty - currentStock;
    const nextStock = currentStock + delta;

    if (nextStock < 0) {
      throw new Error("Stock insuficiente");
    }

    tx.update(ingredientRef, {
      stock: nextStock,
      updatedAt: serverTimestamp(),
    });

    tx.set(movementRef, {
      ingredientId: input.ingredientId,
      qty,
      type: input.type,
      note: input.note ?? "",
      delta,
      beforeStock: currentStock,
      afterStock: nextStock,
      createdAt: serverTimestamp(),
      createdBy: input.createdBy,
    });
  });
}
