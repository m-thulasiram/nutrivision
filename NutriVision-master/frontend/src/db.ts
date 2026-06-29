import type { Meal, HealthProfile } from "./types";

const DB_NAME = "nutrivision";
const DB_VERSION = 1;
const STORE_MEALS = "meals";
const STORE_PROFILE = "profile";

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_MEALS)) {
      const store = db.createObjectStore(STORE_MEALS, { keyPath: "_id" });
      store.createIndex("date", "detectedAt", { unique: false });
    }
    if (!db.objectStoreNames.contains(STORE_PROFILE)) {
      db.createObjectStore(STORE_PROFILE, { keyPath: "key" });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const db = {
  async saveMeal(meal: Meal): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEALS, "readwrite");
      tx.objectStore(STORE_MEALS).put(meal);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async getAllMeals(): Promise<Meal[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEALS, "readonly");
      const req = tx.objectStore(STORE_MEALS).getAll();
      req.onsuccess = () => { db.close(); resolve(req.result || []); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async clearMeals(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEALS, "readwrite");
      tx.objectStore(STORE_MEALS).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async saveProfile(profile: HealthProfile): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILE, "readwrite");
      tx.objectStore(STORE_PROFILE).put({ key: "main", ...profile });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async getProfile(): Promise<HealthProfile | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILE, "readonly");
      const req = tx.objectStore(STORE_PROFILE).get("main");
      req.onsuccess = () => {
        db.close();
        const raw = req.result as Record<string, unknown> | undefined;
        if (raw) {
          const profile: HealthProfile = {
            age: raw.age as number,
            gender: raw.gender as string,
            height: raw.height as number,
            weight: raw.weight as number,
            activityLevel: raw.activityLevel as string,
            fitnessGoal: raw.fitnessGoal as string,
            dietType: raw.dietType as "veg" | "nonveg",
            bmi: raw.bmi as number,
            bmiCategory: raw.bmiCategory as string,
            bmr: raw.bmr as number,
            tdee: raw.tdee as number,
            dailyCalorieTarget: raw.dailyCalorieTarget as number,
            dailyProteinTarget: raw.dailyProteinTarget as number,
            dailyCarbTarget: raw.dailyCarbTarget as number,
            dailyFatTarget: raw.dailyFatTarget as number,
          };
          resolve(profile);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async clearProfile(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILE, "readwrite");
      tx.objectStore(STORE_PROFILE).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },
};
