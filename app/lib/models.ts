import type { Timestamp } from "firebase/firestore";

export type OrderType = "aqui" | "llevar";
export type PayMethod = "Efectivo" | "Nequi" | "Transferencia";
export type OrderStatus = "open" | "closed";

export type LineItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export type OrderDoc = {
  status: OrderStatus;
  label: string;
  orderType: OrderType;
  items: LineItem[];
  additions: LineItem[];
  total: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy: string;
  closedAt?: Timestamp | null;
};

export type OrderDocData = {
  status?: OrderStatus;
  label?: string;
  orderType?: OrderType;
  items?: LineItem[];
  additions?: LineItem[];
  total?: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
  closedAt?: Timestamp | null;
};

export type SaleDoc = {
  orderId: string;
  label: string;
  items: LineItem[];
  additions: LineItem[];
  total: number;
  payMethod: PayMethod;
  orderType: OrderType;
  ticketNumber: number;
  createdAt: Timestamp | null;
  createdBy: string;
};

export type ProductDoc = {
  name: string;
  price: number;
  cost?: number;
  category?: string;
  sku?: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type InventoryMovementType = "in" | "out" | "adjustment";

export type InventoryMovementDoc = {
  ingredientId: string;
  qty: number;
  type: InventoryMovementType;
  note?: string;
  delta: number;
  beforeStock: number;
  afterStock: number;
  createdAt: Timestamp | null;
  createdBy: string;
};

export type IngredientUnit = "unidad" | "g" | "ml" | "porcion";

export type IngredientDoc = {
  name: string;
  unit: IngredientUnit;
  stock: number;
  minStock: number;
  costPerUnit?: number;
  category?: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type RecipeItem = {
  ingredientId: string;
  qty: number;
};

export type RecipeDoc = {
  productId: string;
  items: RecipeItem[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type ExpenseCategory =
  | "nomina"
  | "arriendo"
  | "proveedores"
  | "insumos"
  | "servicios"
  | "imprevistos"
  | "extras";

export type ExpenseDoc = {
  description: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  employeeName?: string;
  note?: string;
  createdAt: Timestamp | null;
  createdBy: string;
};
