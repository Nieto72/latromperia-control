import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { productConverter } from "../converters";
import type { ProductDoc } from "../models";

type CreateProductInput = {
  name: string;
  price: number;
  cost?: number;
  category?: string;
  sku?: string;
};

type UpdateProductInput = Partial<Omit<ProductDoc, "createdAt" | "updatedAt">>;

export async function createProduct(input: CreateProductInput): Promise<void> {
  const productsCol = collection(db, "products").withConverter(productConverter);
  const productRef = doc(productsCol);

  const now = serverTimestamp();

  await setDoc(productRef, {
    name: input.name.trim(),
    price: input.price,
    cost: input.cost ?? undefined,
    category: input.category ?? undefined,
    sku: input.sku ?? undefined,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateProduct(productId: string, patch: UpdateProductInput): Promise<void> {
  const productsCol = collection(db, "products").withConverter(productConverter);
  const productRef = doc(productsCol, productId);
  await updateDoc(productRef, { ...patch, updatedAt: serverTimestamp() });
}
