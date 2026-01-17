import { Person, FaceCrop } from '../types';

const DB_NAME = 'FaceMemDB';
const DB_VERSION = 1;
const STORE_PEOPLE = 'people';
const STORE_FACES = 'faces';

// Simple Promise-based wrapper for IndexedDB
class LocalDB {
  private db: IDBDatabase | null = null;

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PEOPLE)) {
          db.createObjectStore(STORE_PEOPLE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FACES)) {
          db.createObjectStore(STORE_FACES, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async addPerson(person: Person): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PEOPLE, 'readwrite');
      const store = tx.objectStore(STORE_PEOPLE);
      store.put(person);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updatePerson(person: Person): Promise<void> {
    return this.addPerson(person); // put acts as update if key exists
  }

  async deletePerson(id: string): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PEOPLE], 'readwrite');
      const store = tx.objectStore(STORE_PEOPLE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      // Note: We are not deleting the FaceCrop immediately to keep it simple, 
      // but in a real app we should delete from STORE_FACES too.
    });
  }

  async getAllPeople(): Promise<Person[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PEOPLE, 'readonly');
      const store = tx.objectStore(STORE_PEOPLE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addFaceCrop(face: FaceCrop): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FACES, 'readwrite');
      const store = tx.objectStore(STORE_FACES);
      store.put(face);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getFaceCrop(id: string): Promise<FaceCrop | undefined> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FACES, 'readonly');
      const store = tx.objectStore(STORE_FACES);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PEOPLE, STORE_FACES], 'readwrite');
      tx.objectStore(STORE_PEOPLE).clear();
      tx.objectStore(STORE_FACES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new LocalDB();