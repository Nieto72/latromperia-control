import { Timestamp, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { expenseConverter } from "../converters";
import type { ExpenseCategory } from "../models";

type CreateExpenseInput = {
  description: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  employeeName?: string;
  note?: string;
  createdAt?: Date;
  createdBy: string;
};

export async function createExpense(input: CreateExpenseInput): Promise<void> {
  const expensesCol = collection(db, "expenses").withConverter(expenseConverter);
  await addDoc(expensesCol, {
    description: input.description.trim(),
    amount: input.amount,
    category: input.category,
    subcategory: input.subcategory ?? null,
    employeeName: input.employeeName ?? null,
    note: input.note ?? "",
    createdAt: input.createdAt ? Timestamp.fromDate(input.createdAt) : serverTimestamp(),
    createdBy: input.createdBy,
  });
}
