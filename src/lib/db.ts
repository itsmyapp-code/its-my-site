import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Types definition
export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
  type?: "geofence" | "merchant" | "global";
}

export interface ShiftEvent {
  id: string;
  type: "check_in" | "depart" | "return";
  timestamp: string; // ISO String
  locationName: string;
  lat: number;
  lng: number;
  what3words?: string;
  expectedReturn?: string;
  staffId?: string;
  staffName?: string;
}

export interface UserSettings {
  subscribed: boolean;
  subscriptionStartDate?: string;
  cancellationRequested?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  uid: string;
}

// New Staff & Hours Types
export interface Staff {
  id: string;
  name: string;
  phone: string;
  email?: string;
  hourlyRate: number;
}

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  siteId: string;
  siteName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  hours: number;
  validated: boolean;
  validatedAt?: string;
}

// Default mock sites in Dartmouth, UK
const DEFAULT_SITES: Site[] = [
  {
    id: "site-1",
    name: "Dartmouth Castle",
    lat: 50.3428,
    lng: -3.5658,
    radius: 100,
  },
  {
    id: "site-2",
    name: "Town Jetty / Harbour",
    lat: 50.3510,
    lng: -3.5785,
    radius: 150,
  },
  {
    id: "site-3",
    name: "Royal Naval College",
    lat: 50.3562,
    lng: -3.5828,
    radius: 200,
  },
];

// Default mock staff members
const DEFAULT_STAFF: Staff[] = [
  {
    id: "staff-1",
    name: "John Doe",
    phone: "07700 900077",
    email: "john@example.com",
    hourlyRate: 15.00,
  },
  {
    id: "staff-2",
    name: "Sarah Jenkins",
    phone: "07700 900088",
    email: "sarah@example.com",
    hourlyRate: 18.50,
  },
  {
    id: "staff-3",
    name: "Robert Carter",
    phone: "07700 900099",
    email: "robert@example.com",
    hourlyRate: 14.00,
  },
];

// Generate default mock shifts (today's date)
const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const DEFAULT_SHIFTS: Shift[] = [
  {
    id: "shift-1",
    staffId: "staff-1",
    staffName: "John Doe",
    siteId: "site-1",
    siteName: "Dartmouth Castle",
    date: getTodayDateString(),
    startTime: "08:00",
    hours: 8,
    validated: false,
  },
  {
    id: "shift-2",
    staffId: "staff-2",
    staffName: "Sarah Jenkins",
    siteId: "site-2",
    siteName: "Town Jetty / Harbour",
    date: getTodayDateString(),
    startTime: "12:00",
    hours: 6,
    validated: false,
  },
  {
    id: "shift-3",
    staffId: "staff-3",
    staffName: "Robert Carter",
    siteId: "site-3",
    siteName: "Royal Naval College",
    date: getTodayDateString(),
    startTime: "09:00",
    hours: 7,
    validated: false,
  },
];

// Firebase configuration from environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if Firebase config is fully present
const isFirebaseEnabled = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

let dbInstance: any = null;
export let authInstance: any = null;

if (isFirebaseEnabled) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // Initialize Firestore with persistent client-side cache
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
    authInstance = getAuth(app);
    console.log("Firebase Firestore and Auth initialized.");
  } catch (error) {
    console.error("Failed to initialize Firebase services, falling back to LocalStorage:", error);
    dbInstance = null;
    authInstance = null;
  }
} else {
  console.log("No Firebase configuration found. Running in LocalStorage Sandbox Mode.");
}

// Helper to check if string matches what3words pattern (///word.word.word)
export function validateWhat3Words(w3w: string): boolean {
  return /^\/{3}[a-zA-Z\u00C0-\u1FFF\u2C00-\uD7FF]+\.[a-zA-Z\u00C0-\u1FFF\u2C00-\uD7FF]+\.[a-zA-Z\u00C0-\u1FFF\u2C00-\uD7FF]+$/.test(w3w);
}

// LocalStorage helpers for Sandbox Mode
const getLocalData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const setLocalData = <T>(key: string, data: T): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// ==========================================
// DB OPERATIONS
// ==========================================

// 1. SITES MANAGEMENT (scoped under users/{uid}/sites)
export async function dbGetSites(uid: string): Promise<Site[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "sites");
      const snapshot = await getDocs(colRef);
      const sites: Site[] = [];
      snapshot.forEach((doc) => {
        sites.push({ id: doc.id, ...doc.data() } as Site);
      });
      // If Firestore contains nothing, write default mock sites there
      if (sites.length === 0) {
        for (const site of DEFAULT_SITES) {
          const { id, ...rest } = site;
          await setDoc(doc(colRef, id), rest);
          sites.push(site);
        }
      }
      return sites;
    } catch (err) {
      console.error("Error reading sites from Firestore, falling back to local:", err);
    }
  }

  // LocalStorage Fallback
  const localKey = `itsmysite_sites_${uid}`;
  let sites = getLocalData<Site[]>(localKey, []);
  if (sites.length === 0) {
    sites = [...DEFAULT_SITES];
    setLocalData(localKey, sites);
  }
  return sites;
}

export async function dbAddSite(uid: string, site: Omit<Site, "id">): Promise<string> {
  const id = "site-" + Date.now();
  const newSite: Site = { ...site, id };

  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "users", uid, "sites", id), site);
      return id;
    } catch (err) {
      console.error("Error adding site to Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_sites_${uid}`;
  const sites = await dbGetSites(uid);
  sites.push(newSite);
  setLocalData(localKey, sites);
  return id;
}

export async function dbDeleteSite(uid: string, siteId: string): Promise<void> {
  if (dbInstance) {
    try {
      await deleteDoc(doc(dbInstance, "users", uid, "sites", siteId));
      return;
    } catch (err) {
      console.error("Error deleting site from Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_sites_${uid}`;
  const sites = await dbGetSites(uid);
  const updated = sites.filter((s) => s.id !== siteId);
  setLocalData(localKey, updated);
}

// 2. TIMELINE/SHIFT EVENTS (scoped under users/{uid}/events)
export async function dbGetEvents(uid: string): Promise<ShiftEvent[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "events");
      const q = query(colRef, orderBy("timestamp", "asc"));
      const snapshot = await getDocs(q);
      const events: ShiftEvent[] = [];
      snapshot.forEach((doc) => {
        events.push({ id: doc.id, ...doc.data() } as ShiftEvent);
      });
      return events;
    } catch (err) {
      console.error("Error reading events from Firestore, falling back to local:", err);
    }
  }

  // LocalStorage Fallback
  const localKey = `itsmysite_events_${uid}`;
  return getLocalData<ShiftEvent[]>(localKey, []);
}

export async function dbAddEvent(uid: string, event: Omit<ShiftEvent, "id">): Promise<string> {
  const id = "event-" + Date.now();
  const newEvent: ShiftEvent = { ...event, id };

  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "users", uid, "events", id), event);
      return id;
    } catch (err) {
      console.error("Error adding event to Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_events_${uid}`;
  const events = await dbGetEvents(uid);
  events.push(newEvent);
  setLocalData(localKey, events);
  return id;
}

// 3. SETTINGS & BILLING STATE (Exempt/Kept simple, not exposed to user)
const DEFAULT_SETTINGS: UserSettings = {
  subscribed: true,
  subscriptionStartDate: new Date().toISOString(),
  cancellationRequested: false,
};

export async function dbGetSettings(uid: string): Promise<UserSettings> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "users", uid, "settings", "billing");
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserSettings;
      }
      await setDoc(docRef, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    } catch (err) {
      console.error("Error reading settings from Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_settings_${uid}`;
  return getLocalData<UserSettings>(localKey, DEFAULT_SETTINGS);
}

export async function dbSaveSettings(uid: string, settings: UserSettings): Promise<void> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "users", uid, "settings", "billing");
      await setDoc(docRef, settings);
      return;
    } catch (err) {
      console.error("Error saving settings to Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_settings_${uid}`;
  setLocalData(localKey, settings);
}

// 4. AUDIT LOGGING SYSTEM (UK GDPR Article 24 - scoped under users/{uid}/audit_logs)
export async function dbAddAuditLog(uid: string, action: string, details: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry: Omit<AuditLog, "id"> = {
    timestamp,
    action,
    details,
    uid,
  };

  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "audit_logs");
      await addDoc(colRef, logEntry);
    } catch (err) {
      console.error("Error writing audit log to Firestore:", err);
    }
  }

  const localKey = `itsmysite_audit_logs_${uid}`;
  const logs = getLocalData<AuditLog[]>(localKey, []);
  const newLog: AuditLog = { ...logEntry, id: "log-" + Date.now() + Math.random().toString(36).substr(2, 4) };
  logs.push(newLog);
  setLocalData(localKey, logs);

  console.log(`[AUDIT LOG - Article 24 Compliance] [${timestamp}] User: ${uid} | Action: ${action} | Details: ${details}`);
}

export async function dbGetAuditLogs(uid: string): Promise<AuditLog[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "audit_logs");
      const snapshot = await getDocs(colRef);
      const logs: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      console.error("Error reading audit logs from Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_audit_logs_${uid}`;
  return getLocalData<AuditLog[]>(localKey, []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ==========================================
// 5. STAFF DIRECTORY OPERATIONS (scoped users/{uid}/staff)
// ==========================================
export async function dbGetStaff(uid: string): Promise<Staff[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "staff");
      const snapshot = await getDocs(colRef);
      const staff: Staff[] = [];
      snapshot.forEach((doc) => {
        staff.push({ id: doc.id, ...doc.data() } as Staff);
      });
      if (staff.length === 0) {
        for (const item of DEFAULT_STAFF) {
          const { id, ...rest } = item;
          await setDoc(doc(colRef, id), rest);
          if (item.email) {
            await dbAddStaffMapping(item.email, uid, id, item.name);
          }
          staff.push(item);
        }
      }
      return staff;
    } catch (err) {
      console.error("Error reading staff from Firestore, falling back to local:", err);
    }
  }

  const localKey = `itsmysite_staff_${uid}`;
  let staff = getLocalData<Staff[]>(localKey, []);
  if (staff.length === 0) {
    staff = [...DEFAULT_STAFF];
    setLocalData(localKey, staff);
    for (const item of staff) {
      if (item.email) {
        const mappingKey = `itsmysite_staff_mappings_${item.email.toLowerCase()}`;
        setLocalData(mappingKey, { adminUid: uid, staffId: item.id, name: item.name });
      }
    }
  }
  return staff;
}

export async function dbAddStaff(uid: string, staff: Omit<Staff, "id">): Promise<string> {
  const id = "staff-" + Date.now();
  const newStaff: Staff = { ...staff, id };

  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "users", uid, "staff", id), staff);
      if (staff.email) {
        await dbAddStaffMapping(staff.email, uid, id, staff.name);
      }
      return id;
    } catch (err) {
      console.error("Error adding staff to Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_staff_${uid}`;
  const staffList = await dbGetStaff(uid);
  staffList.push(newStaff);
  setLocalData(localKey, staffList);
  if (staff.email) {
    await dbAddStaffMapping(staff.email, uid, id, staff.name);
  }
  return id;
}

export async function dbDeleteStaff(uid: string, staffId: string): Promise<void> {
  try {
    const staffList = await dbGetStaff(uid);
    const staff = staffList.find(s => s.id === staffId);
    if (staff && staff.email) {
      await dbDeleteStaffMapping(staff.email);
    }
  } catch (err) {
    console.error("Failed to clean up staff mapping on deletion:", err);
  }

  if (dbInstance) {
    try {
      await deleteDoc(doc(dbInstance, "users", uid, "staff", staffId));
      return;
    } catch (err) {
      console.error("Error deleting staff from Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_staff_${uid}`;
  const staffList = await dbGetStaff(uid);
  const updated = staffList.filter((s) => s.id !== staffId);
  setLocalData(localKey, updated);
}

// Mappings to resolve workers to their respective admin's space
export interface StaffMapping {
  adminUid: string;
  staffId: string;
  name: string;
}

export async function dbAddStaffMapping(email: string, adminUid: string, staffId: string, name: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "staff_mappings", normalizedEmail), {
        adminUid,
        staffId,
        name,
      });
      return;
    } catch (err) {
      console.error("Error writing staff mapping to Firestore:", err);
    }
  }

  // LocalStorage fallback
  const localKey = `itsmysite_staff_mappings_${normalizedEmail}`;
  setLocalData(localKey, { adminUid, staffId, name });
}

export async function dbDeleteStaffMapping(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  if (dbInstance) {
    try {
      await deleteDoc(doc(dbInstance, "staff_mappings", normalizedEmail));
      return;
    } catch (err) {
      console.error("Error deleting staff mapping from Firestore:", err);
    }
  }

  const localKey = `itsmysite_staff_mappings_${normalizedEmail}`;
  if (typeof window !== "undefined") {
    localStorage.removeItem(localKey);
  }
}

export async function dbGetStaffMapping(email: string): Promise<StaffMapping | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "staff_mappings", normalizedEmail);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as StaffMapping;
      }
      return null;
    } catch (err) {
      console.error("Error reading staff mapping from Firestore:", err);
    }
  }

  // LocalStorage fallback
  const localKey = `itsmysite_staff_mappings_${normalizedEmail}`;
  return getLocalData<StaffMapping | null>(localKey, null);
}

// ==========================================
// 6. SHIFTS SCHEDULER OPERATIONS (scoped users/{uid}/shifts)
// ==========================================
export async function dbGetShifts(uid: string): Promise<Shift[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "users", uid, "shifts");
      const snapshot = await getDocs(colRef);
      const shifts: Shift[] = [];
      snapshot.forEach((doc) => {
        shifts.push({ id: doc.id, ...doc.data() } as Shift);
      });
      if (shifts.length === 0) {
        for (const item of DEFAULT_SHIFTS) {
          const { id, ...rest } = item;
          await setDoc(doc(colRef, id), rest);
          shifts.push(item);
        }
      }
      return shifts;
    } catch (err) {
      console.error("Error reading shifts from Firestore, falling back to local:", err);
    }
  }

  const localKey = `itsmysite_shifts_${uid}`;
  let shifts = getLocalData<Shift[]>(localKey, []);
  if (shifts.length === 0) {
    shifts = [...DEFAULT_SHIFTS];
    setLocalData(localKey, shifts);
  }
  return shifts;
}

export async function dbAddShift(uid: string, shift: Omit<Shift, "id">): Promise<string> {
  const id = "shift-" + Date.now();
  const newShift: Shift = { ...shift, id };

  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "users", uid, "shifts", id), shift);
      return id;
    } catch (err) {
      console.error("Error adding shift to Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_shifts_${uid}`;
  const shifts = await dbGetShifts(uid);
  shifts.push(newShift);
  setLocalData(localKey, shifts);
  return id;
}

export async function dbUpdateShift(uid: string, shiftId: string, data: Partial<Shift>): Promise<void> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "users", uid, "shifts", shiftId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const existing = snapshot.data();
        await setDoc(docRef, { ...existing, ...data });
      }
      return;
    } catch (err) {
      console.error("Error updating shift in Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_shifts_${uid}`;
  const shifts = await dbGetShifts(uid);
  const updated = shifts.map((s) => (s.id === shiftId ? { ...s, ...data } : s));
  setLocalData(localKey, updated);
}

export async function dbDeleteShift(uid: string, shiftId: string): Promise<void> {
  if (dbInstance) {
    try {
      await deleteDoc(doc(dbInstance, "users", uid, "shifts", shiftId));
      return;
    } catch (err) {
      console.error("Error deleting shift from Firestore, using local fallback:", err);
    }
  }

  const localKey = `itsmysite_shifts_${uid}`;
  const shifts = await dbGetShifts(uid);
  const updated = shifts.filter((s) => s.id !== shiftId);
  setLocalData(localKey, updated);
}
