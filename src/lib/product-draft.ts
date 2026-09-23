export type ProductDraft = {
  version: 1;
  updatedAt: number;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  isFree: boolean;
  priceInput: string;
  discountInput: string;
  cashbackInput: string;
  mode: "file" | "url";
  file: File | null;
  externalUrl: string;
  basicInfo: string;
  activationGuide: string;
  inStock: boolean;
  stockInput: string;
  requiresManualDelivery: boolean;
  agreedToSplit: boolean;
  images: File[];
};

const DATABASE_NAME = "oventric-private-drafts";
const STORE_NAME = "product-listings";

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open draft storage"));
  });
}

async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDraftDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Draft storage failed"));
      transaction.onerror = () => reject(transaction.error ?? new Error("Draft storage failed"));
    });
  } finally {
    database.close();
  }
}

export function loadProductDraft(userId: string): Promise<ProductDraft | undefined> {
  return transact("readonly", (store) => store.get(userId));
}

export async function saveProductDraft(userId: string, draft: ProductDraft): Promise<void> {
  await transact("readwrite", (store) => store.put(draft, userId));
}

export async function deleteProductDraft(userId: string): Promise<void> {
  await transact("readwrite", (store) => store.delete(userId));
}