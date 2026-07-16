"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  MapPin, 
  ShieldAlert, 
  Clock, 
  UserCheck, 
  History,
  HardDrive,
  UserCheck2,
  CalendarDays,
  Menu,
  X,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
  PoundSterling,
  HelpCircle
} from "lucide-react";

// Components
import { ConsentBanner } from "@/components/ConsentBanner";
import { ValidationPrompts } from "@/components/ValidationPrompts";
import { GeofenceDetector } from "@/components/GeofenceDetector";
import { OffSiteModule } from "@/components/OffSiteModule";
import { StaffManager } from "@/components/StaffManager";
import { 
  authInstance,
  dbGetStaffMapping,
  dbSaveSettings,
  dbAddAuditLog,
  dbGetAuditLogs, 
  AuditLog, 
  ShiftEvent, 
  dbGetEvents, 
  dbGetSites, 
  dbGetStaff, 
  dbGetShifts, 
  Staff, 
  Shift,
  dbGetValidationRequests
} from "@/lib/db";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import dynamic from "next/dynamic";

const TimelineMap = dynamic(
  () => import("@/components/TimelineMap").then((mod) => mod.TimelineMap),
  { ssr: false, loading: () => <div className="h-[400px] lg:h-[500px] bg-slate-950 flex items-center justify-center text-slate-400 font-bold animate-pulse text-sm">LOADING LEAFLET MAP CANVAS...</div> }
);

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<"admin" | "worker">("admin");
  const [uid, setUid] = useState("admin-worker-hybrid-101");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activePrompt, setActivePrompt] = useState(false);
  const [adminSubView, setAdminSubView] = useState<"overview" | "staff" | "map" | "logs">("staff");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"menu" | "help">("menu");
  const [notifPermission, setNotifPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);
  
  // Dashboard Metrics & Lists
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeSiteCount, setActiveSiteCount] = useState(3);
  const [eventsCount, setEventsCount] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);

  // Staff simulation state for Worker View
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [workerShifts, setWorkerShifts] = useState<Shift[]>([]);

  const [allAdminShifts, setAllAdminShifts] = useState<Shift[]>([]);
  const [allAdminStaff, setAllAdminStaff] = useState<Staff[]>([]);

  // Fetch metrics and audit logs
  const fetchDashboardData = async () => {
    try {
      const logs = await dbGetAuditLogs(uid);
      setAuditLogs(logs.slice(0, 15)); // Top 15 logs
      
      const sites = await dbGetSites(uid);
      setActiveSiteCount(sites.length);
      
      const events = await dbGetEvents(uid);
      setEventsCount(events.length);
      
      const checkIns = events.filter(e => e.type === "check_in");
      if (checkIns.length > 0) {
        const last = checkIns[checkIns.length - 1];
        setLastCheckIn(`${last.locationName} (${new Date(last.timestamp).toLocaleTimeString("en-GB")})`);
      } else {
        setLastCheckIn("None this shift");
      }

      // Load staff list for worker view simulation
      const staffList = await dbGetStaff(uid);
      setStaffMembers(staffList);
      setAllAdminStaff(staffList);
      
      // If worker is logged in, use mapped staff profile
      if (role === "worker" && staffId) {
        setSelectedStaffId(staffId);
      } else if (staffList.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffList[0].id);
      }

      // Load shifts
      const allShifts = await dbGetShifts(uid);
      setAllAdminShifts(allShifts);
      if (role === "worker" && staffId) {
        setWorkerShifts(allShifts.filter(s => s.staffId === staffId));
      } else if (selectedStaffId) {
        setWorkerShifts(allShifts.filter(s => s.staffId === selectedStaffId));
      } else if (staffList.length > 0) {
        setWorkerShifts(allShifts.filter(s => s.staffId === staffList[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!authInstance) {
      const cached = typeof window !== "undefined" ? localStorage.getItem("itsmysite_mock_user") : null;
      if (cached) {
        setUser({ email: cached });
        if (cached === "admin@example.com" || cached.includes("admin")) {
          setRole("admin");
          setUid("admin-worker-hybrid-101");
          setStaffId(null);
        } else {
          setRole("worker");
          setUid("admin-worker-hybrid-101");
          dbGetStaff("admin-worker-hybrid-101").then((staffList) => {
            const matched = staffList.find(s => s.email && s.email.toLowerCase() === cached.toLowerCase());
            if (matched) {
              setStaffId(matched.id);
              setSelectedStaffId(matched.id);
            }
          });
        }
      }
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
      setLoadingAuth(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        if (firebaseUser.email) {
          const mapping = await dbGetStaffMapping(firebaseUser.email);
          if (mapping) {
            setRole("worker");
            setUid(mapping.adminUid);
            setStaffId(mapping.staffId);
            setSelectedStaffId(mapping.staffId);
          } else {
            setRole("admin");
            setUid(firebaseUser.uid);
            setStaffId(null);
          }
        } else {
          setRole("admin");
          setUid(firebaseUser.uid);
          setStaffId(null);
        }
      } else {
        setUser(null);
        setRole("admin");
        setUid("admin-worker-hybrid-101");
        setStaffId(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, [authInstance]);

  useEffect(() => {
    if (!loadingAuth) {
      fetchDashboardData();
    }
  }, [uid, refreshTrigger, selectedStaffId, role, staffId, loadingAuth]);

  // Register Service Worker for PWA support
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((registration) => {
          console.log("ServiceWorker registration successful with scope: ", registration.scope);
        })
        .catch((err) => {
          console.log("ServiceWorker registration failed: ", err);
        });
    }
  }, []);

  const handleValidationSuccess = (event: ShiftEvent) => {
    setRefreshTrigger(prev => prev + 1);
  };

  const playChime = () => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc1.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio chime blocked by browser autoplay policy:", e);
    }
  };

  // Background monitoring for site validation checkpoints
  useEffect(() => {
    if (role !== "worker") return;

    const interval = setInterval(async () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hh}:${mm}`;

      const todayStr = now.toISOString().split("T")[0];
      const todaysShifts = workerShifts.filter((s) => s.date === todayStr);

      const allSites = await dbGetSites(uid);
      let shouldPrompt = false;
      let matchedSiteName = "";

      // 1. Check Scheduled Checkpoints
      if (todaysShifts.length > 0) {
        for (const shift of todaysShifts) {
          const site = allSites.find((s) => s.id === shift.siteId);
          if (site && site.validationTimes && site.validationTimes.includes(timeStr)) {
            shouldPrompt = true;
            matchedSiteName = site.name;
            break;
          }
        }
      }

      // 2. Check Instant Admin Dispatch Requests
      try {
        const reqs = await dbGetValidationRequests(uid);
        const nowTime = new Date().getTime();
        // Request triggered in the last 45 seconds
        const recent = reqs.filter(r => (nowTime - new Date(r.timestamp).getTime()) < 45000);
        
        for (const req of recent) {
          if (req.targetType === "staff") {
            if (req.targetIds.includes(selectedStaffId || "")) {
              shouldPrompt = true;
              matchedSiteName = "Requested Zone";
              break;
            }
          } else if (req.targetType === "site") {
            const workerSiteIds = todaysShifts.map(s => s.siteId);
            if (req.targetIds.some(id => workerSiteIds.includes(id))) {
              shouldPrompt = true;
              const matchedSite = allSites.find(s => req.targetIds.includes(s.id));
              matchedSiteName = matchedSite ? matchedSite.name : "Target Site";
              break;
            }
          }
        }
      } catch (err) {
        console.warn("Failed checking instant validation requests:", err);
      }

      if (shouldPrompt && !activePrompt) {
        setActivePrompt(true);
        playChime();
        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("itsmysite - Validation Required", {
              body: `Are you on-site at ${matchedSiteName}? Active shift verification is scheduled now.`,
              icon: "/favicon.ico",
            });
          }
        }
        await dbAddAuditLog(uid, "VALIDATION_PROMPT_TRIGGERED", `Validation prompt triggered for worker at site ${matchedSiteName}`);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [role, workerShifts, activePrompt, uid, selectedStaffId]);

  const handleOffSiteSuccess = (event: ShiftEvent) => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDataModified = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (!user) {
    if (loadingAuth) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-slate-950 font-mono text-sm text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-4" />
          <span>ESTABLISHING SECURE CONNECTION...</span>
        </div>
      );
    }
    return (
      <LoginScreen 
        authInstance={authInstance} 
        onMockLogin={async (email) => {
          if (typeof window !== "undefined") {
            localStorage.setItem("itsmysite_mock_user", email);
          }
          setUser({ email });
          if (email === "admin@example.com" || email.includes("admin")) {
            setRole("admin");
            setUid("admin-worker-hybrid-101");
            setStaffId(null);
          } else {
            setRole("worker");
            setUid("admin-worker-hybrid-101");
            const staffList = await dbGetStaff("admin-worker-hybrid-101");
            const matched = staffList.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());
            if (matched) {
              setStaffId(matched.id);
              setSelectedStaffId(matched.id);
            }
          }
          await dbAddAuditLog("admin-worker-hybrid-101", "MOCK_LOGIN_SUCCESS", `Simulated sign in for ${email}`);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col text-sm sm:text-base">
      {/* HEADER BANNER */}
      <header className="bg-slate-900 border-b border-slate-800 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3.5">
            <img 
              src="/itsmysite.png?v=2" 
              alt="itsmysite logo" 
              className="h-11 w-auto object-contain"
            />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
                <span>itsmysite</span>
              </h1>
              <span className="text-xs text-slate-500 font-bold block">Geofencing, Staffing & Shift Validation</span>
            </div>
          </div>

          {/* VIEWPORT MODE SELECTOR & MENU */}
          <div className="flex items-center gap-3">
            {/* Show simulator toggle ONLY in sandbox mode (when no user is logged in) */}
            {!user ? (
              <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-850 p-1.5 rounded-none text-xs sm:text-sm">
                <span className="text-slate-500 font-bold px-2 uppercase tracking-wide">SIMULATOR:</span>
                <button
                  onClick={() => setRole("admin")}
                  className={`px-4 py-1.5 cursor-pointer transition uppercase font-bold rounded-none ${
                    role === "admin"
                      ? "bg-brand-blue text-slate-955"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Admin Dashboard
                </button>
                <button
                  onClick={() => setRole("worker")}
                  className={`px-4 py-1.5 cursor-pointer transition uppercase font-bold rounded-none ${
                    role === "worker"
                      ? "bg-brand-yellow text-slate-955"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Field Worker App
                </button>
              </div>
            ) : (
              /* If logged in, show their email details */
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-3 py-2 rounded-none text-xs text-slate-400 font-mono font-bold uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{role === "admin" ? "ADMIN" : "STAFF"}: {user.email}</span>
              </div>
            )}

            {/* Hamburger button (visible for both Admin and Staff) */}
            {(role === "admin" || role === "worker") && (
              <button
                onClick={() => setIsMenuOpen(true)}
                className="h-10 w-10 border border-slate-850 bg-slate-955 hover:bg-slate-900 text-slate-200 hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
                title="Help & Control Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Sign Out Button */}
            {user && (
              <button
                onClick={async () => {
                  if (authInstance) {
                    await signOut(authInstance);
                  } else {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("itsmysite_mock_user");
                    }
                    setUser(null);
                    setRole("admin");
                    setUid("admin-worker-hybrid-101");
                    setStaffId(null);
                  }
                }}
                className="h-10 px-4 border border-slate-850 bg-slate-955 hover:bg-slate-900 text-slate-200 hover:text-slate-100 flex items-center justify-center font-bold uppercase transition cursor-pointer text-xs gap-1.5"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. ADMIN LANDSCAPE PC VIEW                                                */}
        {/* ========================================================================= */}
        {role === "admin" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Screen Size Warning for Testing */}
            <div className="xl:hidden p-4 bg-amber-955/70 border border-brand-yellow/30 text-brand-yellow text-xs sm:text-sm flex items-center gap-3 leading-normal">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>
                <strong>LAYOUT READABILITY GUIDE:</strong> Admin view sections are now separated into sections via the top-right Hamburger Menu or quick horizontal tabs below.
              </span>
            </div>

            {/* Dashboard Sub-view Horizontal Tabs */}
            <div className="flex border-b border-slate-800 font-mono text-xs sm:text-sm gap-2 overflow-x-auto pb-0.5">
              <button 
                onClick={() => setAdminSubView("staff")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "staff" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Staff Directory & Rota
              </button>
              <button 
                onClick={() => setAdminSubView("map")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "map" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Geofence Map & Tracking
              </button>
              <button 
                onClick={() => setAdminSubView("overview")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "overview" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Analytics Dashboard
              </button>
              <button 
                onClick={() => setAdminSubView("logs")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "logs" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-350"
                }`}
              >
                Audit Registers
              </button>
            </div>

            {/* RENDER ACTIVE SUB-VIEW */}
            {adminSubView === "overview" && (
              <div className="space-y-6">
                {/* BENTO GRID METRICS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Box 1: KPI Summary Metrics */}
                  <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between h-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-16 bg-brand-blue" />
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-550 uppercase font-bold tracking-wider">Active Geofenced Sites</span>
                      <MapPin className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-100">{activeSiteCount}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Configured geofences in the UK</div>
                  </div>

                  {/* Box 2: KPI Check-in Metrics */}
                  <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between h-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-16 bg-brand-yellow" />
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-550 uppercase font-bold tracking-wider">Shift Logs Total</span>
                      <UserCheck className="w-5 h-5 text-brand-yellow" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-100">{eventsCount}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Total validation events recorded</div>
                  </div>

                  {/* Box 3: Last Active Check-in Status */}
                  <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between h-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-16 bg-brand-red" />
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-550 uppercase font-bold tracking-wider">Last Shift Event</span>
                      <Clock className="w-5 h-5 text-brand-red" />
                    </div>
                    <div className="text-sm font-bold text-slate-200 truncate pr-2" title={lastCheckIn || "None"}>
                      {lastCheckIn || "No data recorded"}
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase">Live check-in stream</div>
                  </div>

                  {/* Box 4: GDPR/Audit Sandbox Health */}
                  <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between h-36 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-1 w-16 bg-purple-500" />
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-slate-550 uppercase font-bold tracking-wider">Local Persistence</span>
                      <HardDrive className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{authInstance ? "Firebase Active" : "LocalStorage Sandbox"}</span>
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase">Auto-Offline Cache Enabled</div>
                  </div>
                </div>

                {/* Quick Actions Shortcuts */}
                <div className="p-6 bg-slate-900 border border-slate-850 space-y-4 font-mono text-sm">
                  <h4 className="text-base font-bold text-slate-100 uppercase tracking-wider border-b border-slate-800 pb-2">Quick Navigation Portal</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button 
                      onClick={() => setAdminSubView("staff")} 
                      className="p-4 border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-200 font-bold uppercase transition text-center cursor-pointer text-xs tracking-wider"
                    >
                      Configure Staff & Hours
                    </button>
                    <button 
                      onClick={() => setAdminSubView("map")} 
                      className="p-4 border border-slate-800 bg-slate-955 hover:bg-slate-850 text-slate-200 font-bold uppercase transition text-center cursor-pointer text-xs tracking-wider"
                    >
                      Open Live Tracking Map
                    </button>
                    <button 
                      onClick={() => setAdminSubView("logs")} 
                      className="p-4 border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-200 font-bold uppercase transition text-center cursor-pointer text-xs tracking-wider"
                    >
                      Audit GDPR Registers
                    </button>
                  </div>
                </div>
              </div>
            )}

            {adminSubView === "staff" && (
              <div className="bg-slate-900 border border-slate-800 p-5">
                <StaffManager uid={uid} refreshTrigger={refreshTrigger} onDataModified={handleDataModified} />
              </div>
            )}

            {adminSubView === "map" && (
              <div className="bg-slate-900 border border-slate-800 p-5">
                <TimelineMap uid={uid} refreshTrigger={refreshTrigger} />
              </div>
            )}

            {adminSubView === "logs" && (
              <div className="bg-slate-900 border border-slate-800 p-5 flex flex-col h-[520px]">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-400" />
                    <span>UK GDPR Article 24 Security Audit Registry</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Secure Internal Archive</span>
                </div>

                <div className="overflow-y-auto grow space-y-2 pr-1 text-sm">
                  {auditLogs.length === 0 ? (
                    <div className="text-slate-600 text-center py-12 italic">No audit records logged. Actions will report here.</div>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-955 border border-slate-850 rounded-none space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-extrabold text-purple-400 uppercase">{log.action}</span>
                          <span className="text-slate-500 font-medium">
                            {new Date(log.timestamp).toLocaleString("en-GB")}
                          </span>
                        </div>
                        <p className="text-slate-300 leading-normal font-semibold text-sm">{log.details}</p>
                        <div className="text-[10px] text-slate-600 flex justify-between font-medium">
                          <span>Database Scope: users/{log.uid.substring(0, 10)}...</span>
                          <span className="text-emerald-500 font-semibold">Integrity Verified</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="text-xs text-slate-500 pt-4 border-t border-slate-850 mt-3 leading-normal font-bold">
                  This secure log ledger meets Article 24 of UK GDPR accountability controls.
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. FIELD WORKER MOBILE VIEW                                              */}
        {/* ========================================================================= */}
        {role === "worker" && (
          <div className="max-w-lg mx-auto space-y-6 bg-slate-950/40 border border-slate-800 p-5 sm:p-6 relative overflow-hidden">
            
            {/* Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-yellow" />
            
            {/* Staff Member Selector (Choose Profile) - only show dropdown if running in simulator (no resolved staffId) */}
            {!staffId && (
              <div className="bg-slate-900 border border-slate-800 p-4 space-y-2">
                <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Select Your Worker Profile
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm font-semibold"
                >
                  {staffMembers.map(member => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                  {staffMembers.length === 0 && <option value="">No staff registered. Toggle to Admin View to add staff.</option>}
                </select>
              </div>
            )}

            {/* Worker Shift Status Badge */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-850 p-4 rounded-none text-sm">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Logged In As:</span>
                <span className="text-sm font-bold text-slate-100">
                  {staffMembers.find(s => s.id === selectedStaffId)?.name || (user ? user.email : "Guest Operator")}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Your Scheduled Shifts:</span>
                <span className="text-sm font-bold text-brand-yellow">{workerShifts.length} scheduled</span>
              </div>
            </div>

            {/* Notification Permission Banner */}
            {typeof window !== "undefined" && "Notification" in window && (
              <div className="bg-slate-900 border border-slate-850 p-4 rounded-none text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 leading-normal">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-0.5">Push Notifications Status:</span>
                  <span className={`font-bold ${
                    notifPermission === "granted" ? "text-emerald-500" :
                    notifPermission === "denied" ? "text-rose-400" :
                    "text-brand-yellow"
                  }`}>
                    {notifPermission === "granted" ? "🔔 Notifications Active & Authorized" :
                     notifPermission === "denied" ? "🔕 Blocked (Check Browser Settings)" :
                     "🔔 Notifications Disabled"}
                  </span>
                </div>
                {notifPermission === "default" && (
                  <button
                    type="button"
                    onClick={() => {
                      Notification.requestPermission().then((perm) => {
                        setNotifPermission(perm);
                        dbAddAuditLog(uid, "NOTIFICATION_PERMISSION_REQUESTED", `Worker requested notification permissions: ${perm}`);
                      });
                    }}
                    className="h-8 px-3.5 bg-brand-yellow hover:bg-yellow-500 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-[10px] cursor-pointer whitespace-nowrap shrink-0 border-none"
                  >
                    Enable Alerts
                  </button>
                )}
              </div>
            )}

            {/* WORKER'S SPECIFIC ASSIGNED SHIFTS LIST */}
            <div className="bg-slate-900 border border-slate-800 p-4 space-y-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-850 pb-2">
                Your Scheduled Shifts
              </span>
              
              <div className="space-y-2.5 max-h-48 overflow-y-auto">
                {workerShifts.length === 0 ? (
                  <div className="text-slate-500 text-xs italic py-4 text-center">
                    You have no scheduled shifts assigned in this rota.
                  </div>
                ) : (
                  workerShifts.map((shift) => (
                    <div key={shift.id} className="p-4 bg-slate-950 border border-slate-800 rounded-none flex justify-between items-center gap-3">
                      <div>
                        <div className="font-extrabold text-slate-100 text-sm">{shift.siteName}</div>
                        <div className="text-slate-400 text-xs font-semibold mt-1">
                          Date: <span className="text-slate-200">{(() => {
                            const p = shift.date.split("-");
                            return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : shift.date;
                          })()}</span> | Hours: <span className="text-slate-200">{shift.hours} hrs</span> | Start: <span className="text-slate-200">{shift.startTime}</span>
                        </div>
                      </div>
                      <div>
                        <span className={`px-2.5 py-1 text-[10px] font-extrabold border rounded-none uppercase tracking-wider leading-none ${
                          shift.validated 
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800" 
                            : "bg-slate-900 text-rose-450 border-rose-955 animate-pulse"
                        }`}>
                          {shift.validated ? "VALIDATED" : "CHECK-IN REQ"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SCHEDULED PROMPT MONITOR */}
            <ValidationPrompts 
              uid={uid} 
              role={role}
              onOpenValidation={() => {
                const element = document.getElementById("geofence-detector-box");
                if (element) element.scrollIntoView({ behavior: "smooth" });
              }}
              activePrompt={activePrompt}
              setActivePrompt={setActivePrompt}
            />

            {/* ACTIVE GEOFENCE DETECTOR */}
            <div id="geofence-detector-box">
              <GeofenceDetector 
                uid={uid} 
                onValidationSuccess={handleValidationSuccess}
                activePrompt={activePrompt}
                setActivePrompt={setActivePrompt}
                selectedStaffId={selectedStaffId}
                selectedStaffName={staffMembers.find(s => s.id === selectedStaffId)?.name || (user ? user.email : undefined)}
              />
            </div>

            {/* TRANSIT OFF-SITE LOGGER */}
            <OffSiteModule 
              uid={uid} 
              onOffSiteSuccess={handleOffSiteSuccess} 
              selectedStaffId={selectedStaffId}
              selectedStaffName={staffMembers.find(s => s.id === selectedStaffId)?.name || (user ? user.email : undefined)}
            />

          </div>
        )}

      </main>

      {/* GLOBAL FOOTER COMPLIANCE WORKSPACE */}
      <footer className="bg-slate-950 border-t border-slate-900 mt-10 py-8 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          {/* Static Compliance Navigation */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex flex-wrap gap-4 text-slate-400 font-bold uppercase tracking-wider">
              <Link href="/terms" className="hover:text-brand-blue transition">/terms</Link>
              <Link href="/privacy" className="hover:text-brand-blue transition">/privacy</Link>
              <Link href="/cookies" className="hover:text-brand-blue transition">/cookies</Link>
              <Link href="/accessibility" className="hover:text-brand-blue transition">/accessibility</Link>
            </div>
            <div className="text-slate-300 font-bold text-xs uppercase tracking-wider pt-2">
              Powered by <a href="https://itsmyapp.co.uk" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">itsmyapp.co.uk</a>
            </div>
          </div>
          
          {/* Regulatory query lead */}
          <div className="max-w-xl md:text-right leading-relaxed font-semibold text-slate-450">
            Data Privacy & Compliance Queries: For any questions regarding your data rights, or to submit an inquiry, 
            please contact our Data Privacy Lead directly at <a href="mailto:hello@itsmyapp.co.uk" className="text-slate-100 hover:text-brand-blue font-extrabold underline">hello@itsmyapp.co.uk</a>. 
            We formally acknowledge all compliance submissions within 30 days.
          </div>

        </div>
        
        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-900 text-center flex flex-col sm:flex-row justify-between text-[11px] text-slate-700">
          <span>&copy; {new Date().getFullYear()} itsmysite. All rights reserved. Registered UK GDPR Entity.</span>
        </div>
      </footer>

      {/* SYSTEM CONTROL & HELP DRAWER */}
      {isMenuOpen && (role === "admin" || role === "worker") && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur overlay */}
          <div 
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-slate-955/60 backdrop-blur-sm transition-opacity" 
          />
          
          {/* Menu Panel */}
          <div className="relative w-80 max-w-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 z-50">
            <div className="space-y-6 overflow-y-auto max-h-[85vh] pr-1">
              
              {/* Drawer Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Menu className="w-5 h-5 text-brand-blue" />
                  <span className="font-mono font-bold text-slate-100 uppercase tracking-wider text-sm">
                    {role === "admin" ? "Admin Control" : "System Support"}
                  </span>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {drawerTab === "help" || role === "worker" ? (
                /* ---------------- HELP & INSTRUCTIONS VIEW ---------------- */
                <div className="space-y-4 font-sans text-slate-350">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                    <span className="font-mono font-bold text-slate-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-brand-yellow animate-pulse" />
                      <span>Quick Help Manual</span>
                    </span>
                    {role === "admin" && (
                      <button
                        onClick={() => setDrawerTab("menu")}
                        className="text-xs text-brand-blue font-bold hover:underline cursor-pointer"
                      >
                        &larr; Control Panel
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed">
                    {/* Worker Instructions */}
                    <div className="space-y-2 bg-slate-950/70 border border-slate-850 p-3">
                      <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-widest block border-b border-slate-800 pb-1">
                        📲 Worker PWA Setup (Mobile App)
                      </span>
                      <p className="font-bold text-slate-200">How to add to your Phone:</p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                        <li>
                          <strong className="text-slate-300">Apple iOS (Safari):</strong> Tap the <strong className="text-slate-100">Share</strong> icon (square with up-arrow) at the bottom, scroll down, and select <strong className="text-slate-100">"Add to Home Screen"</strong>.
                        </li>
                        <li>
                          <strong className="text-slate-300">Android (Chrome):</strong> Tap the <strong className="text-slate-100">Three-Dot Menu</strong> at the top-right, and choose <strong className="text-slate-100">"Install App"</strong> or <strong className="text-slate-100">"Add to Home Screen"</strong>.
                        </li>
                      </ul>
                      <p className="pt-2 font-bold text-slate-200">Operator Guidelines:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                        <li>Open the app on your home screen and log in using your registered email.</li>
                        <li>Accept <strong className="text-slate-300">Location Permissions</strong> to enable on-site check-in verification.</li>
                        <li>When validation prompts sound, tap <strong className="text-slate-100">"Validate My Shift Location"</strong>.</li>
                        <li>If leaving site for transit (supplies/errands), log your journey in the <strong className="text-slate-100">Transit Departure Logger</strong>.</li>
                      </ol>
                    </div>

                    {/* Admin Instructions */}
                    {role === "admin" && (
                      <div className="space-y-2 bg-slate-950/70 border border-slate-850 p-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-widest block border-b border-slate-800 pb-1">
                          🛡️ Admin Dashboard Guide
                        </span>
                        <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                          <li>
                            <strong className="text-slate-300">Roster Scheduling:</strong> Register workers and schedule dates/shifts. Workers sign in using these pre-registered emails.
                          </li>
                          <li>
                            <strong className="text-slate-300">Geofencing & Locations:</strong> Draw geofences. Configure checkpoints and pre-define transit locations workers can log.
                          </li>
                          <li>
                            <strong className="text-slate-300">Validate Now:</strong> Force an immediate manual validation prompt onto the screen of a specific worker or all workers.
                          </li>
                          <li>
                            <strong className="text-slate-300">Admin Areas:</strong> Link manager offices or depots to sites to validate associated worker rota shifts.
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ---------------- ADMIN MENU PANELS VIEW ---------------- */
                <>
                  {/* Navigation Links */}
                  <nav className="flex flex-col gap-2.5 font-mono text-sm">
                    <button
                      onClick={() => { setAdminSubView("staff"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "staff" 
                          ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                          : "bg-slate-905 hover:bg-slate-850 text-slate-400 border-slate-850"
                      }`}
                    >
                      Staff Directory & Rota
                    </button>

                    <button
                      onClick={() => { setAdminSubView("map"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "map" 
                          ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                          : "bg-slate-905 hover:bg-slate-850 text-slate-400 border-slate-850"
                      }`}
                    >
                      Geofence Map & Tracking
                    </button>

                    <button
                      onClick={() => { setAdminSubView("overview"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "overview" 
                          ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                          : "bg-slate-955 hover:bg-slate-850 text-slate-400 border-slate-850"
                      }`}
                    >
                      Analytics Dashboard
                    </button>

                    <button
                      onClick={() => { setAdminSubView("logs"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "logs" 
                          ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                          : "bg-slate-905 hover:bg-slate-850 text-slate-400 border-slate-850"
                      }`}
                    >
                      Audit Registers
                    </button>

                    <button
                      onClick={() => { setDrawerTab("help"); }}
                      className="w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer bg-slate-905 hover:bg-slate-850 text-brand-yellow border-slate-850"
                    >
                      Help & PWA Guide
                    </button>
                  </nav>

                  {/* Shift Hours & Estimated Payroll Report (Admin Drawer) */}
                  {(() => {
                    const totalSchHours = allAdminShifts.reduce((sum, s) => sum + s.hours, 0);
                    const totalValHours = allAdminShifts.reduce((sum, s) => sum + (s.validated ? s.hours : 0), 0);
                    const payDetails = allAdminShifts.reduce((acc, shift) => {
                      const staff = allAdminStaff.find(s => s.id === shift.staffId);
                      const rate = staff ? staff.hourlyRate : 15.00;
                      const pay = shift.hours * rate;
                      if (shift.validated) {
                        acc.validatedPay += pay;
                      } else {
                        acc.pendingPay += pay;
                      }
                      return acc;
                    }, { validatedPay: 0, pendingPay: 0 });
                    const totPayroll = payDetails.validatedPay + payDetails.pendingPay;

                    return (
                      <div className="bg-slate-955 border border-slate-850 p-4 space-y-3 font-mono text-xs">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-slate-200">
                          <PoundSterling className="w-4 h-4 text-brand-blue" />
                          <span className="font-bold uppercase tracking-wider">Payroll Report (GBP)</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-slate-400">
                            <span className="text-slate-500 font-bold uppercase">Scheduled</span>
                            <span className="font-extrabold">{totalSchHours.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span className="text-slate-500 font-bold uppercase">Validated</span>
                            <span className="text-brand-blue font-extrabold">{totalValHours.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-850 pt-2 text-slate-355">
                            <span className="text-slate-500 font-bold uppercase">Total Est. Pay</span>
                            <span className="text-brand-yellow font-extrabold">£{totPayroll.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="space-y-1 text-[11px] border-t border-slate-850 pt-2 text-slate-500 font-medium">
                          <div className="flex justify-between">
                            <span>Verified Pay:</span>
                            <span className="text-emerald-500 font-bold">£{payDetails.validatedPay.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pending Pay:</span>
                            <span className="text-rose-450 font-bold">£{payDetails.pendingPay.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

            </div>

            {/* Footer indicator */}
            <div className="font-mono text-xs text-slate-600 border-t border-slate-850 pt-4">
              <span>itsmysite PWA engine v4.0</span>
            </div>
          </div>
        </div>
      )}

      {/* COMPLIANCE COOKIE LAYER */}
      <ConsentBanner />

    </div>
  );
}

interface LoginScreenProps {
  authInstance: any;
  onMockLogin: (email: string) => void;
}

function LoginScreen({ authInstance, onMockLogin }: LoginScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    if (!authInstance) {
      setTimeout(() => {
        setLoading(false);
        onMockLogin(email.trim());
      }, 400);
      return;
    }

    try {
      if (isRegister) {
        // Register new Admin
        const userCredential = await createUserWithEmailAndPassword(authInstance, email.trim(), password);
        await dbSaveSettings(userCredential.user.uid, {
          subscribed: true,
          subscriptionStartDate: new Date().toISOString(),
          cancellationRequested: false,
        });
        await dbAddAuditLog(
          userCredential.user.uid,
          "ADMIN_ACCOUNT_CREATED",
          `Admin registered account for ${email.trim()}.`
        );
      } else {
        // Sign In
        await signInWithEmailAndPassword(authInstance, email.trim(), password);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/email-already-in-use") {
        errMsg = "This email address is already in use.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "Password must be at least 6 characters.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        errMsg = "Invalid email or password.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setResetMessage("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(authInstance, email.trim());
      setResetMessage("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      console.error(err);
      let errMsg = "Failed to send password reset email. Please verify the email address.";
      if (err.code === "auth/invalid-email") {
        errMsg = "Invalid email address format.";
      } else if (err.code === "auth/user-not-found") {
        errMsg = "No account found with this email.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-955 px-4 py-12 font-mono text-sm text-slate-355">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-blue" />
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <img src="/itsmysite.png?v=2" alt="itsmysite" className="h-12 mx-auto mb-4 object-contain" />
          <h2 className="text-lg font-bold text-slate-100 uppercase tracking-widest flex items-center justify-center gap-2">
            <span>itsmysite</span>
            <span className="text-xs bg-brand-blue text-slate-955 px-1.5 py-0.5 font-extrabold uppercase">SECURE</span>
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-1">GEOFENCING & SHIFT MANAGEMENT PORTAL</p>
        </div>

        {isForgotPassword ? (
          /* Forgot Password View */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">Reset Password</h3>
            <p className="text-xs text-slate-500 leading-normal">
              Enter your email address below, and we will send you a secure link to reset your password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-955/50 border border-rose-900 text-rose-350 font-bold text-xs">
                  {error}
                </div>
              )}
              {resetMessage && (
                <div className="p-3 bg-emerald-955/50 border border-emerald-800 text-emerald-350 font-bold text-xs">
                  {resetMessage}
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="operator@company.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm rounded-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-brand-blue hover:bg-blue-600 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer border-none"
              >
                {loading ? (
                  <span className="animate-pulse">SENDING RESET LINK...</span>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center pt-4 border-t border-slate-850">
              <button
                onClick={() => { setIsForgotPassword(false); setError(""); setResetMessage(""); }}
                className="text-xs text-slate-400 hover:text-brand-blue font-bold uppercase transition cursor-pointer bg-transparent border-none"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Register View */
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-955/50 border border-rose-900 text-rose-350 font-bold text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="operator@company.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm rounded-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm rounded-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-350 cursor-pointer bg-transparent border-none"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {!isRegister && (
                <div className="flex justify-between items-center mt-1.5">
                  <span />
                  <button
                    type="button"
                    onClick={() => { setIsForgotPassword(true); setError(""); setResetMessage(""); }}
                    className="text-xs text-slate-500 hover:text-brand-blue font-bold transition bg-transparent border-none cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-brand-blue hover:bg-blue-600 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer border-none"
            >
              {loading ? (
                <span className="animate-pulse">AUTHENTICATING...</span>
              ) : (
                <span>{isRegister ? "Register Admin Account" : "Secure Log In"}</span>
              )}
            </button>
          </form>
        )}

        {/* Toggle Mode */}
        {!isForgotPassword && (
          <div className="mt-6 text-center pt-4 border-t border-slate-850">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
              className="text-xs text-slate-400 hover:text-brand-blue font-bold uppercase transition cursor-pointer bg-transparent border-none"
            >
              {isRegister ? "Already have an account? Sign In" : "Need to set up a new company? Register Admin"}
            </button>
          </div>
        )}

        {/* Sandbox Warning Notice */}
        {!authInstance && (
          <div className="mt-4 p-3 bg-amber-955/40 border border-brand-yellow/30 text-brand-yellow text-[11px] leading-normal font-sans">
            <strong>LocalStorage Sandbox Mode:</strong> Firebase config not found. You can enter any email to sign in: use <code>admin@example.com</code> for Admin view, or a registered worker email.
          </div>
        )}

        {/* Compliance Note */}
        <p className="text-[10px] text-slate-600 leading-normal mt-8 text-center font-semibold uppercase tracking-wider">
          Access is monitored and audited. Fully compliant with UK GDPR Article 24 accountability standards.
        </p>
      </div>
    </div>
  );
}
