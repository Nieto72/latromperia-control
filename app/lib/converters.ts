import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  WithFieldValue,
} from "firebase/firestore";
import type {
  ExpenseDoc,
  IngredientDoc,
  InventoryMovementDoc,
  OrderDoc,
  ProductDoc,
  RecipeDoc,
  SaleDoc,
} from "./models";

export type WithId<T> = T & { id: string };

const passthroughConverter = <T>(): FirestoreDataConverter<T> => ({
  toFirestore(data: WithFieldValue<T>): DocumentData {
    return data as DocumentData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
    return snapshot.data(options) as T;
  },
});

export const orderConverter = passthroughConverter<OrderDoc>();
export const saleConverter = passthroughConverter<SaleDoc>();
export const productConverter = passthroughConverter<ProductDoc>();
export const inventoryConverter = passthroughConverter<InventoryMovementDoc>();
export const expenseConverter = passthroughConverter<ExpenseDoc>();
export const ingredientConverter = passthroughConverter<IngredientDoc>();
export const recipeConverter = passthroughConverter<RecipeDoc>();
