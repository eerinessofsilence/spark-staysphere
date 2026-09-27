/** Browser-only queue. Photos are kept in IndexedDB until the server confirms the event. */
export interface OfflineHousekeepingChange {
  id: string;
  scope: string;
  hotelSlug: string;
  unitId: string;
  status: 'dirty' | 'in_progress' | 'clean';
  note: string;
  photoData: string | null;
}

export interface OfflineRoom {
  unitId: string;
  hotelSlug: string;
  hotelName: string;
  number: string;
  floor: number;
  roomTypeName: string;
  status: string;
}

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('staysphere-housekeeper', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('changes', { keyPath: 'id' });
      db.createObjectStore('rooms', { keyPath: 'scope' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function operate<T>(storeName: string, mode: IDBTransactionMode, perform: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = perform(tx.objectStore(storeName));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export const queueChange = (change: OfflineHousekeepingChange) => operate('changes', 'readwrite', (store) => store.put(change));
export const removeChange = (id: string) => operate('changes', 'readwrite', (store) => store.delete(id));
export async function queuedChanges(scope: string): Promise<OfflineHousekeepingChange[]> {
  const all = await operate<OfflineHousekeepingChange[]>('changes', 'readonly', (store) => store.getAll());
  return all.filter((change) => change.scope === scope);
}
export const cacheRooms = (scope: string, rooms: OfflineRoom[]) => operate('rooms', 'readwrite', (store) => store.put({ scope, rooms }));
export async function cachedRooms(scope: string): Promise<OfflineRoom[]> {
  const entry = await operate<{ scope: string; rooms: OfflineRoom[] } | undefined>('rooms', 'readonly', (store) => store.get(scope));
  return entry?.rooms ?? [];
}
