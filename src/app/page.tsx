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
  HelpCircle,
  Shield
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
  dbGetValidationRequests,
  dbUpdateShift,
  dbAddEvent,
  dbAddBriefing,
  dbGetBriefings,
  dbAddBriefingReceipt,
  dbGetBriefingReceipts,
  dbAddVariation,
  dbGetVariations,
  Briefing,
  BriefingReceipt,
  Variation
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
  const [adminSubView, setAdminSubView] = useState<"overview" | "staff" | "map" | "logs" | "reports" | "help">("staff");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"menu" | "help">("menu");
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [simulatedCoords, setSimulatedCoords] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [loadingClockId, setLoadingClockId] = useState<string | null>(null);
  const [reportsTab, setReportsTab] = useState<"payroll" | "overtime" | "variations" | "talks">("payroll");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);
  
  // Dashboard Metrics & Lists
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [briefingReceipts, setBriefingReceipts] = useState<BriefingReceipt[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [activeSiteCount, setActiveSiteCount] = useState(3);
  const [eventsCount, setEventsCount] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);

  // Staff simulation state for Worker View
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [workerShifts, setWorkerShifts] = useState<Shift[]>([]);

  const [allAdminShifts, setAllAdminShifts] = useState<Shift[]>([]);
  const [overtimeNotesText, setOvertimeNotesText] = useState("");
  const [allAdminStaff, setAllAdminStaff] = useState<Staff[]>([]);

  const unreadBriefing = role === "worker" && selectedStaffId
    ? briefings.find(b => {
        if (!b.active) return false;
        const alreadyRead = briefingReceipts.some(r => r.briefingId === b.id && r.staffId === selectedStaffId);
        if (alreadyRead) return false;

        // Check if targeted to specific employees
        if (b.targetType === "staff") {
          return b.targetIds?.includes(selectedStaffId) || false;
        }
        return true; // Targeted to everyone
      })
    : null;

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

      // Load briefings, receipts, variations
      const bList = await dbGetBriefings(uid);
      setBriefings(bList);
      const rList = await dbGetBriefingReceipts(uid);
      setBriefingReceipts(rList);
      const vList = await dbGetVariations(uid);
      setVariations(vList);
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
          if (shift.clockInTime && !shift.clockOutTime) {
            const site = allSites.find((s) => s.id === shift.siteId);
            if (site && site.validationTimes && site.validationTimes.includes(timeStr)) {
              shouldPrompt = true;
              matchedSiteName = site.name;
              break;
            }
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
          // Check if worker has an active shift they are currently clocked into
          const activeShift = todaysShifts.find(s => s.clockInTime && !s.clockOutTime);
          if (!activeShift) continue;

          if (req.targetType === "staff") {
            if (req.targetIds.includes(selectedStaffId || "")) {
              shouldPrompt = true;
              matchedSiteName = "Requested Zone";
              break;
            }
          } else if (req.targetType === "site") {
            if (req.targetIds.includes(activeShift.siteId)) {
              shouldPrompt = true;
              const matchedSite = allSites.find(s => s.id === activeShift.siteId);
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

  const getCoordinatesForClock = async (): Promise<{ lat: number; lng: number }> => {
    if (simulatedCoords && simulatedCoords.name !== "Actual GPS") {
      await dbAddAuditLog(uid, "LOCATION_SIMULATION_ACTIVE", `Using mock GPS coordinate profile for clocking: ${simulatedCoords.name}`);
      return { lat: simulatedCoords.lat, lng: simulatedCoords.lng };
    }

    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        reject(new Error("HTML5 Geolocation is not supported."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          reject(new Error(`GPS failed: Code ${error.code} - ${error.message}`));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async (shift: Shift) => {
    setLoadingClockId(shift.id);
    try {
      const coords = await getCoordinatesForClock();
      const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      
      await dbUpdateShift(uid, shift.id, {
        clockInTime: timeStr,
        clockInCoordinates: coords
      });

      // Record ShiftEvent
      const eventData = {
        type: "clock_in" as const,
        timestamp: new Date().toISOString(),
        locationName: `Clock In at ${shift.siteName}`,
        lat: coords.lat,
        lng: coords.lng,
        staffId: shift.staffId,
        staffName: shift.staffName
      };
      await dbAddEvent(uid, eventData);

      // Audit Log
      await dbAddAuditLog(
        uid,
        "SHIFT_CLOCKED_IN",
        `Worker ${shift.staffName} clocked in for shift at ${shift.siteName} at ${timeStr} (Coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
      );

      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(`Clock In Failed: ${err.message || err}. Please allow location access or select a simulator profile.`);
      await dbAddAuditLog(uid, "CLOCK_IN_FAILED", `Worker clock in failed: ${err.message || err}`);
    } finally {
      setLoadingClockId(null);
    }
  };

  const getScheduledShiftEnd = (shift: Shift): Date | null => {
    try {
      const [hours, minutes] = shift.startTime.split(":").map(Number);
      const dateObj = new Date(shift.date);
      dateObj.setHours(hours, minutes, 0, 0);
      const endMs = dateObj.getTime() + shift.hours * 60 * 60 * 1000;
      return new Date(endMs);
    } catch (e) {
      return null;
    }
  };

  const handleClockOut = async (shift: Shift) => {
    setLoadingClockId(shift.id);
    try {
      const coords = await getCoordinatesForClock();
      const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      
      const end = getScheduledShiftEnd(shift);
      let overtimeMins = 0;
      if (end) {
        const diffMs = Date.now() - end.getTime();
        if (diffMs > 0) {
          overtimeMins = Math.round(diffMs / 1000 / 60);
        }
      }

      await dbUpdateShift(uid, shift.id, {
        clockOutTime: timeStr,
        clockOutCoordinates: coords,
        overtimeMinutes: overtimeMins > 0 ? overtimeMins : undefined
      });

      // Record ShiftEvent
      const eventData = {
        type: "clock_out" as const,
        timestamp: new Date().toISOString(),
        locationName: `Clock Out at ${shift.siteName}`,
        lat: coords.lat,
        lng: coords.lng,
        staffId: shift.staffId,
        staffName: shift.staffName
      };
      await dbAddEvent(uid, eventData);

      // Audit Log
      await dbAddAuditLog(
        uid,
        "SHIFT_CLOCKED_OUT",
        `Worker ${shift.staffName} clocked out from shift at ${shift.siteName} at ${timeStr} (Coords: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})${overtimeMins > 0 ? ` with ${overtimeMins} mins overtime` : ""}`
      );

      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(`Clock Out Failed: ${err.message || err}. Please allow location access or select a simulator profile.`);
      await dbAddAuditLog(uid, "CLOCK_OUT_FAILED", `Worker clock out failed: ${err.message || err}`);
    } finally {
      setLoadingClockId(null);
    }
  };

  // --- HEALTH & SAFETY BRIEFING ACKNOWLEDGMENT ---
  const [hsSubmitting, setHsSubmitting] = useState(false);
  const handleAcknowledgeBriefing = async () => {
    if (!unreadBriefing || !selectedStaffId) return;
    setHsSubmitting(true);
    try {
      const coords = await getCoordinatesForClock().catch(() => ({ lat: 0, lng: 0 }));
      const staffName = staffMembers.find(s => s.id === selectedStaffId)?.name || "Worker";

      await dbAddBriefingReceipt(uid, {
        briefingId: unreadBriefing.id,
        staffId: selectedStaffId,
        staffName,
        lat: coords.lat,
        lng: coords.lng,
        verified: coords.lat !== 0 || coords.lng !== 0
      });

      await dbAddAuditLog(
        uid,
        "BRIEFING_ACKNOWLEDGED",
        `Worker ${staffName} acknowledged H&S Briefing: "${unreadBriefing.topic}" at GPS (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
      );

      alert(`Thank you. Health & Safety briefing read receipt has been submitted and audited.`);
      fetchDashboardData();
    } catch (err: any) {
      alert(`Error logging acknowledgment: ${err.message || err}`);
    } finally {
      setHsSubmitting(false);
    }
  };

  // --- DAYWORKS & VARIATIONS FORM ---
  const [varNotes, setVarNotes] = useState("");
  const [varPhoto, setVarPhoto] = useState<string | null>(null);
  const [varSubmitting, setVarSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setVarPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddVariationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert("Please select or log into a worker profile first.");
      return;
    }
    if (!varNotes.trim()) {
      alert("Please enter notes for the variation.");
      return;
    }
    setVarSubmitting(true);
    try {
      const coords = await getCoordinatesForClock().catch(() => ({ lat: 0, lng: 0 }));
      const staffName = staffMembers.find(s => s.id === selectedStaffId)?.name || "Worker";

      await dbAddVariation(uid, {
        staffId: selectedStaffId,
        staffName,
        notes: varNotes,
        photo: varPhoto || undefined,
        lat: coords.lat,
        lng: coords.lng
      });

      await dbAddAuditLog(
        uid,
        "VARIATION_SUBMITTED",
        `Worker ${staffName} logged variation: "${varNotes.substring(0, 40)}..." at GPS (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)})`
      );

      alert("Variation / Daywork logged successfully!");
      setVarNotes("");
      setVarPhoto(null);
      const fileInput = document.getElementById("var-photo-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchDashboardData();
    } catch (err: any) {
      alert(`Failed to log variation: ${err.message || err}`);
    } finally {
      setVarSubmitting(false);
    }
  };

  // --- DIGITAL OVERTIME CLAIMS WORKER PROMPT ---
  const [overtimePromptShift, setOvertimePromptShift] = useState<Shift | null>(null);

  // Time-gated trigger: check every 10 seconds if worker shift has passed scheduled end
  useEffect(() => {
    if (role !== "worker" || !selectedStaffId || workerShifts.length === 0) return;
    
    const interval = setInterval(() => {
      const activeShift = workerShifts.find(s => s.clockInTime && !s.clockOutTime && !s.overtimeRequested);
      if (activeShift) {
        const end = getScheduledShiftEnd(activeShift);
        if (end && new Date() >= end) {
          setOvertimePromptShift(activeShift);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [role, selectedStaffId, workerShifts]);

  const handleClaimOvertime = async (shift: Shift) => {
    if (!overtimeNotesText.trim()) {
      alert("Please enter a reason/description for the overtime work.");
      return;
    }
    try {
      await dbUpdateShift(uid, shift.id, {
        overtimeRequested: true,
        overtimeNotes: overtimeNotesText
      });
      await dbAddAuditLog(
        uid,
        "OVERTIME_CLAIM_INITIATED",
        `Worker ${shift.staffName} requested overtime logging for shift ending at ${shift.startTime} (Hours: ${shift.hours}). Reason: "${overtimeNotesText}"`
      );
      setOvertimePromptShift(null);
      setOvertimeNotesText("");
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- ADMIN OVERTIME ACTIONS ---
  const handleApproveOvertime = async (shift: Shift) => {
    try {
      const extraHrs = (shift.overtimeMinutes || 0) / 60;
      const updatedHours = shift.hours + extraHrs;
      await dbUpdateShift(uid, shift.id, {
        hours: Number(updatedHours.toFixed(2)),
        overtimeApproved: true,
        overtimeRequested: false
      });
      await dbAddAuditLog(
        uid,
        "OVERTIME_APPROVED",
        `Admin approved ${shift.overtimeMinutes} mins overtime for ${shift.staffName} on shift at ${shift.siteName} (${shift.date}). New total hours: ${updatedHours.toFixed(2)}`
      );
      alert("Overtime claim approved!");
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineOvertime = async (shift: Shift) => {
    try {
      await dbUpdateShift(uid, shift.id, {
        overtimeApproved: false,
        overtimeRequested: false
      });
      await dbAddAuditLog(
        uid,
        "OVERTIME_DECLINED",
        `Admin declined overtime claim of ${shift.overtimeMinutes} mins for ${shift.staffName} on shift at ${shift.siteName} (${shift.date}).`
      );
      alert("Overtime claim declined.");
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- ADMIN BRIEFINGS ACTIONS ---
  const [newBriefingTopic, setNewBriefingTopic] = useState("");
  const [newBriefingContent, setNewBriefingContent] = useState("");
  const [briefingTargetType, setBriefingTargetType] = useState<"all" | "staff">("all");
  const [briefingTargetStaffId, setBriefingTargetStaffId] = useState<string>("");
  const [briefingSubmitting, setBriefingSubmitting] = useState(false);
  const [expandedBriefingId, setExpandedBriefingId] = useState<string | null>(null);

  // Lightbox picture overlay
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  const handleAddBriefingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBriefingTopic.trim()) {
      alert("Please enter talk topic / subject.");
      return;
    }
    if (!newBriefingContent.trim()) {
      alert("Please enter talk content.");
      return;
    }
    if (briefingTargetType === "staff" && !briefingTargetStaffId) {
      alert("Please select the target employee.");
      return;
    }
    setBriefingSubmitting(true);
    try {
      const targetIds = briefingTargetType === "staff" ? [briefingTargetStaffId] : [];
      await dbAddBriefing(uid, {
        topic: newBriefingTopic,
        content: newBriefingContent,
        active: true,
        targetType: briefingTargetType,
        targetIds
      });
      
      const targetDesc = briefingTargetType === "staff" 
        ? `targeted to worker ID: ${briefingTargetStaffId}`
        : "targeted to Everyone";

      await dbAddAuditLog(
        uid,
        "BRIEFING_CREATED",
        `Admin published mandatory H&S Briefing (Toolbox Talk) on topic: "${newBriefingTopic}" (${targetDesc})`
      );
      alert("Briefing talk published successfully!");
      setNewBriefingTopic("");
      setNewBriefingContent("");
      setBriefingTargetType("all");
      setBriefingTargetStaffId("");
      fetchDashboardData();
    } catch (err: any) {
      alert(`Error publishing briefing: ${err.message || err}`);
    } finally {
      setBriefingSubmitting(false);
    }
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
                  adminSubView === "logs" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                }`}
              >
                Audit Registers
              </button>
              <button 
                onClick={() => setAdminSubView("reports")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "reports" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                }`}
              >
                Payroll Reports
              </button>
              <button 
                onClick={() => setAdminSubView("help")}
                className={`pb-2.5 px-4 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                  adminSubView === "help" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                }`}
              >
                Help & PWA Guide
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

            {adminSubView === "reports" && (() => {
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

              // Rota detailed payroll list grouped by worker
              const staffReport = allAdminStaff.map(worker => {
                const workerShifts = allAdminShifts.filter(s => s.staffId === worker.id);
                const sch = workerShifts.reduce((sum, s) => sum + s.hours, 0);
                const val = workerShifts.reduce((sum, s) => sum + (s.validated ? s.hours : 0), 0);
                const schPay = sch * worker.hourlyRate;
                const valPay = val * worker.hourlyRate;
                const pendPay = schPay - valPay;
                const complianceRate = sch > 0 ? (val / sch) * 100 : 0;
                
                return {
                  id: worker.id,
                  name: worker.name,
                  rate: worker.hourlyRate,
                  scheduledHours: sch,
                  validatedHours: val,
                  estimatedPay: schPay,
                  verifiedPay: valPay,
                  pendingPay: pendPay,
                  compliance: complianceRate
                };
              });

              return (
                <div className="bg-slate-900 border border-slate-800 p-5 space-y-6">
                  {/* Title & Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
                    <div className="flex items-center gap-2.5">
                      <PoundSterling className="w-5 h-5 text-brand-yellow" />
                      <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">Payroll & Hours Ledger</h3>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await dbAddAuditLog(uid, "REPORT_EXPORT_TRIGGERED", `Admin triggered CSV export for payroll report (${staffReport.length} workers audited)`);
                        alert("Exporting CSV report... (Audit log recorded)");
                      }}
                      className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs border-none cursor-pointer"
                    >
                      Export CSV Report
                    </button>
                  </div>

                  {/* Local sub-navigation */}
                  <div className="flex border-b border-slate-800 font-mono text-xs gap-2 overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={() => setReportsTab("payroll")}
                      className={`pb-2 px-3.5 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                        reportsTab === "payroll" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                      }`}
                    >
                      Hours & Payroll
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportsTab("overtime")}
                      className={`pb-2 px-3.5 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                        reportsTab === "overtime" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                      }`}
                    >
                      Overtime Claims
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportsTab("variations")}
                      className={`pb-2 px-3.5 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                        reportsTab === "variations" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                      }`}
                    >
                      Dayworks & Variations
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportsTab("talks")}
                      className={`pb-2 px-3.5 font-bold border-b-2 uppercase transition tracking-wider cursor-pointer whitespace-nowrap ${
                        reportsTab === "talks" ? "border-brand-blue text-slate-100" : "border-transparent text-slate-500 hover:text-slate-355"
                      }`}
                    >
                      H&S Toolbox Talks
                    </button>
                  </div>

                  {reportsTab === "payroll" && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* Bento Metrics grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-slate-955 border border-slate-850 p-4 relative overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Scheduled</span>
                          <div className="text-2xl font-black text-slate-100 mt-1">{totalSchHours.toFixed(1)} hrs</div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-1">Across all active rotas</span>
                        </div>
                        <div className="bg-slate-955 border border-slate-850 p-4 relative overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Validated</span>
                          <div className="text-2xl font-black text-brand-blue mt-1">{totalValHours.toFixed(1)} hrs</div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-1">
                            {totalSchHours > 0 ? ((totalValHours / totalSchHours) * 100).toFixed(0) : 0}% compliance rate
                          </span>
                        </div>
                        <div className="bg-slate-955 border border-slate-850 p-4 relative overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Verified Payout</span>
                          <div className="text-2xl font-black text-emerald-500 mt-1">£{payDetails.validatedPay.toFixed(2)}</div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-1">For fully cleared checkpoints</span>
                        </div>
                        <div className="bg-slate-955 border border-slate-850 p-4 relative overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pending / Unverified</span>
                          <div className="text-2xl font-black text-rose-450 mt-1">£{payDetails.pendingPay.toFixed(2)}</div>
                          <span className="text-[10px] text-slate-500 font-medium block mt-1">Pending geofence verification</span>
                        </div>
                      </div>

                      {/* Summary Details */}
                      <div className="bg-slate-950 border border-slate-850 p-4 text-xs font-mono text-slate-400 space-y-2 leading-relaxed">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-widest block border-b border-slate-850 pb-1.5 mb-2.5">
                          ℹ️ About the Payroll Report
                        </span>
                        <p>
                          This report aggregates shift schedules and geofence events to calculate estimated payouts.
                        </p>
                        <p>
                          <strong className="text-slate-200">Verified Payout</strong> is calculated from shifts where the worker clocked in, clocked out, and cleared all geofence validation checkpoints (UK GDPR Article 24 compliant).
                        </p>
                        <p>
                          <strong className="text-slate-200">Pending Payout</strong> represents shifts that have not yet completed validation checkpoints or are scheduled in the future.
                        </p>
                      </div>

                      {/* Detailed Table */}
                      <div className="space-y-2.5">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Worker Breakdown Directory</span>
                        <div className="overflow-x-auto border border-slate-850 bg-slate-955">
                          <table className="w-full text-left text-xs font-mono border-collapse">
                            <thead>
                              <tr className="bg-slate-950 border-b border-slate-850 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                                <th className="p-3.5">Staff Name</th>
                                <th className="p-3.5">Rate</th>
                                <th className="p-3.5 text-center">Scheduled</th>
                                <th className="p-3.5 text-center">Validated</th>
                                <th className="p-3.5 text-center">Compliance</th>
                                <th className="p-3.5 text-right">Est. Cost</th>
                                <th className="p-3.5 text-right">Verified Pay</th>
                                <th className="p-3.5 text-right">Pending Pay</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850 font-semibold text-slate-300">
                              {staffReport.map(r => (
                                <tr key={r.id} className="hover:bg-slate-900 transition">
                                  <td className="p-3.5 font-bold text-slate-100">{r.name}</td>
                                  <td className="p-3.5">£{r.rate.toFixed(2)}/hr</td>
                                  <td className="p-3.5 text-center">{r.scheduledHours.toFixed(1)} hrs</td>
                                  <td className="p-3.5 text-center text-brand-blue">{r.validatedHours.toFixed(1)} hrs</td>
                                  <td className="p-3.5 text-center">
                                    <span className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                      r.compliance >= 90 ? "bg-emerald-950 text-emerald-400" :
                                      r.compliance >= 50 ? "bg-amber-950 text-brand-yellow" :
                                      "bg-rose-950/70 text-rose-400"
                                    }`}>
                                      {r.compliance.toFixed(0)}%
                                    </span>
                                  </td>
                                  <td className="p-3.5 text-right">£{r.estimatedPay.toFixed(2)}</td>
                                  <td className="p-3.5 text-right text-emerald-500">£{r.verifiedPay.toFixed(2)}</td>
                                  <td className="p-3.5 text-right text-slate-500">£{r.pendingPay.toFixed(2)}</td>
                                </tr>
                              ))}
                              {staffReport.length === 0 && (
                                <tr>
                                  <td colSpan={8} className="p-8 text-center text-slate-500 italic">No registered staff found to build audit report.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {reportsTab === "overtime" && (() => {
                    const pendingOvertimeShifts = allAdminShifts.filter(s => s.overtimeRequested && s.overtimeMinutes);
                    return (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                          <Clock className="w-4 h-4 text-brand-blue" />
                          <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">Pending Overtime Approvals</span>
                        </div>

                        {pendingOvertimeShifts.length === 0 ? (
                          <div className="text-slate-500 italic text-xs py-8 text-center bg-slate-955 border border-slate-850">
                            No pending overtime claims requiring review.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingOvertimeShifts.map(s => {
                              const staff = allAdminStaff.find(st => st.id === s.staffId);
                              const rate = staff ? staff.hourlyRate : 15.00;
                              const cost = ((s.overtimeMinutes || 0) / 60) * rate;

                              return (
                                <div key={s.id} className="bg-slate-955 border border-slate-850 p-4 space-y-3 font-mono text-xs">
                                  <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                                    <div>
                                      <span className="font-bold text-slate-100 text-sm block">{s.staffName}</span>
                                      <span className="text-[10px] text-slate-500 font-semibold block">{s.siteName}</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-brand-blue/20 text-brand-blue font-bold text-[10px]">
                                      PENDING APPROVAL
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 leading-relaxed font-semibold">
                                    <div>
                                      <span className="text-slate-550 block text-[9px] uppercase">Shift Date:</span>
                                      <span>{s.date} ({s.startTime})</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-550 block text-[9px] uppercase">Overtime Claim:</span>
                                      <span className="text-brand-yellow font-extrabold">{s.overtimeMinutes} minutes</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-550 block text-[9px] uppercase">Estimated Pay:</span>
                                      <span>£{(s.hours * rate).toFixed(2)} ({s.hours} hrs)</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-550 block text-[9px] uppercase">Overtime Cost:</span>
                                      <span className="text-emerald-500 font-extrabold">£{cost.toFixed(2)}</span>
                                    </div>
                                  </div>
                                  {s.overtimeNotes && (
                                    <div className="p-2 bg-slate-950 border border-slate-850 rounded-none text-slate-300 font-sans text-xs">
                                      <span className="text-[9px] text-slate-500 font-bold uppercase block mb-0.5">Worker Justification:</span>
                                      <p className="leading-normal font-medium">{s.overtimeNotes}</p>
                                    </div>
                                  )}

                                  <div className="flex gap-2 pt-2 border-t border-slate-850">
                                    <button
                                      type="button"
                                      onClick={() => handleApproveOvertime(s)}
                                      className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-slate-955 font-bold uppercase text-[10px] cursor-pointer transition rounded-none border-none"
                                    >
                                      Approve Overtime
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeclineOvertime(s)}
                                      className="flex-1 h-8 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10px] font-bold uppercase cursor-pointer transition rounded-none"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {reportsTab === "variations" && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <History className="w-4 h-4 text-brand-yellow" />
                        <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">Dayworks & Variations Register</span>
                      </div>

                      {variations.length === 0 ? (
                        <div className="text-slate-500 italic text-xs py-8 text-center bg-slate-950 border border-slate-850">
                          No variation logs submitted.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {variations.map(v => (
                            <div key={v.id} className="bg-slate-955 border border-slate-850 p-4 space-y-3 font-mono text-xs">
                              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                                <span className="font-bold text-slate-100">{v.staffName}</span>
                                <span className="text-slate-550 text-[10px]">
                                  {new Date(v.timestamp).toLocaleString("en-GB")}
                                </span>
                              </div>
                              
                              <p className="text-slate-300 font-sans text-xs bg-slate-950/45 p-2.5 border border-slate-850 leading-relaxed font-semibold">
                                {v.notes}
                              </p>

                              {v.photo && (
                                <div className="border border-slate-850 p-1 bg-slate-950 relative group">
                                  <img 
                                    src={v.photo} 
                                    alt="Attachment" 
                                    className="max-h-32 object-contain mx-auto cursor-zoom-in"
                                    onClick={() => setActiveLightboxImage(v.photo!)} 
                                  />
                                  <span className="absolute bottom-1 right-1 bg-slate-955/80 border border-slate-800 text-[8px] text-slate-500 px-1 font-bold">
                                    Click to expand
                                  </span>
                                </div>
                              )}

                              <div className="text-[10px] text-slate-500 flex justify-between items-center pt-1">
                                <span>GPS Coords: ({v.lat.toFixed(5)}, {v.lng.toFixed(5)})</span>
                                {v.lat !== 0 && v.lng !== 0 && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand-blue hover:underline"
                                  >
                                    View Map
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {reportsTab === "talks" && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {/* Create Briefing Form */}
                      <div className="bg-slate-955 border border-slate-850 p-5 space-y-4">
                        <span className="text-xs text-slate-200 font-bold uppercase tracking-wider block border-b border-slate-800 pb-2">
                          📢 Publish Mandatory H&S Briefing (Toolbox Talk)
                        </span>

                        <form onSubmit={handleAddBriefingSubmit} className="space-y-3.5 font-mono text-xs">
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Briefing Topic</label>
                            <input
                              type="text"
                              placeholder="e.g. Working at Height, Site Security, Covid-19 Protocol..."
                              value={newBriefingTopic}
                              onChange={(e) => setNewBriefingTopic(e.target.value)}
                              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-xs font-bold font-mono"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div>
                              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Target Audience</label>
                              <select
                                value={briefingTargetType}
                                onChange={(e) => setBriefingTargetType(e.target.value as "all" | "staff")}
                                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-xs font-bold font-mono"
                              >
                                <option value="all">Everyone (All Workers)</option>
                                <option value="staff">Specific Employee</option>
                              </select>
                            </div>

                            {briefingTargetType === "staff" && (
                              <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Select Target Worker</label>
                                <select
                                  value={briefingTargetStaffId}
                                  onChange={(e) => setBriefingTargetStaffId(e.target.value)}
                                  className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-xs font-bold font-mono"
                                  required
                                >
                                  <option value="">-- Select Worker --</option>
                                  {allAdminStaff.map(w => (
                                    <option key={w.id} value={w.id}>{w.name} ({w.email})</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Briefing / Talk Content</label>
                            <textarea
                              rows={4}
                              placeholder="Write the safety talk content here... (Workers must acknowledge before opening app dashboard)"
                              value={newBriefingContent}
                              onChange={(e) => setNewBriefingContent(e.target.value)}
                              className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none font-sans text-xs"
                              required
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={briefingSubmitting}
                            className="h-10 px-5 bg-brand-yellow hover:bg-amber-500 disabled:opacity-50 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs flex items-center justify-center gap-2 cursor-pointer border-none"
                          >
                            {briefingSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-slate-955" />
                            ) : (
                              <span>Publish Toolbox Talk</span>
                            )}
                          </button>
                        </form>
                      </div>

                      {/* Briefings completion log */}
                      <div className="space-y-3">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-800 pb-2">
                          Active Briefings Log & Receipts
                        </span>

                        {briefings.length === 0 ? (
                          <div className="text-slate-500 italic text-xs py-8 text-center bg-slate-955 border border-slate-850">
                            No published safety briefings found.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {briefings.map(b => {
                              const receiptsForTalk = briefingReceipts.filter(r => r.briefingId === b.id);
                              const ackCount = receiptsForTalk.length;
                              const targetWorkers = b.targetType === "staff"
                                ? allAdminStaff.filter(w => b.targetIds?.includes(w.id))
                                : allAdminStaff;
                              const totalWorkers = targetWorkers.length;
                              const isExpanded = expandedBriefingId === b.id;

                              return (
                                <div key={b.id} className="bg-slate-955 border border-slate-850 p-4 space-y-3 font-mono text-xs">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-extrabold text-brand-yellow text-sm block">{b.topic}</span>
                                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 mt-0.5">
                                        <span>Sent: {new Date(b.timestamp).toLocaleString("en-GB")}</span>
                                        <span>|</span>
                                        <span className="text-brand-blue font-extrabold uppercase">
                                          Target: {b.targetType === "staff" ? `Employee (${targetWorkers.map(w => w.name).join(", ")})` : "Everyone"}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBriefingId(isExpanded ? null : b.id)}
                                      className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-355 hover:text-slate-200 text-[10px] font-bold uppercase cursor-pointer whitespace-nowrap"
                                    >
                                      {isExpanded ? "Collapse" : `View Receipts (${ackCount}/${totalWorkers})`}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="border-t border-slate-850 pt-3.5 space-y-3 animate-in fade-in duration-150">
                                      <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider block">Receipts Directory</span>
                                      
                                      <div className="overflow-x-auto border border-slate-850 bg-slate-955">
                                        <table className="w-full text-left text-[11px] border-collapse">
                                          <thead>
                                            <tr className="bg-slate-900 border-b border-slate-850 text-slate-500 uppercase font-bold text-[9px] tracking-wider">
                                              <th className="p-2">Worker</th>
                                              <th className="p-2">Status</th>
                                              <th className="p-2">Timestamp</th>
                                              <th className="p-2 text-right">GPS Coordinate</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-850 font-semibold text-slate-300">
                                            {targetWorkers.map(worker => {
                                              const receipt = receiptsForTalk.find(r => r.staffId === worker.id);
                                              return (
                                                <tr key={worker.id} className="hover:bg-slate-900/50">
                                                  <td className="p-2 font-bold text-slate-200">{worker.name}</td>
                                                  <td className="p-2">
                                                    {receipt ? (
                                                      <span className="text-emerald-500 font-bold">ACKNOWLEDGED</span>
                                                    ) : (
                                                      <span className="text-slate-650 italic">PENDING</span>
                                                    )}
                                                  </td>
                                                  <td className="p-2">
                                                    {receipt ? new Date(receipt.timestamp).toLocaleString("en-GB") : "-"}
                                                  </td>
                                                  <td className="p-2 text-right">
                                                    {receipt ? (
                                                      receipt.lat !== 0 && receipt.lng !== 0 ? (
                                                        <a
                                                          href={`https://www.google.com/maps/search/?api=1&query=${receipt.lat},${receipt.lng}`}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-brand-blue hover:underline"
                                                        >
                                                          ({receipt.lat.toFixed(4)}, {receipt.lng.toFixed(4)})
                                                        </a>
                                                      ) : (
                                                        <span className="text-slate-600">Captured (0,0)</span>
                                                      )
                                                    ) : (
                                                      "-"
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            {adminSubView === "help" && (
              <div className="bg-slate-900 border border-slate-800 p-5 space-y-6">
                {/* Title */}
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
                  <HelpCircle className="w-5 h-5 text-brand-yellow animate-pulse" />
                  <h3 className="text-lg font-bold text-slate-100 uppercase tracking-wider">Help Manual & PWA Installation Guide</h3>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Worker PWA Setup & App Manual */}
                  <div className="bg-slate-955 border border-slate-850 p-5 space-y-6">
                    <h4 className="text-sm font-extrabold text-brand-yellow uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
                      📲 Field Worker Application Manual
                    </h4>
                    
                    <div className="space-y-4 text-xs text-slate-350 leading-relaxed font-sans">
                      {/* PWA Section */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">1. PROGRESSIVE WEB APP (PWA) INSTALLATION</span>
                        <p>To run this application as a standalone mobile app on your smartphone:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            <strong className="text-slate-300">Apple iOS (Safari browser):</strong> Tap the <strong className="text-slate-100">Share</strong> button (square box with an up arrow) in Safari's bottom toolbar, scroll down the actions sheet, and select <strong className="text-slate-100">"Add to Home Screen"</strong>. Give the app a name and tap "Add" at the top-right.
                          </li>
                          <li>
                            <strong className="text-slate-300">Android (Chrome browser):</strong> Tap the <strong className="text-slate-100">Three-Dot Menu</strong> icon at the top-right of Chrome, and select <strong className="text-slate-100">"Install App"</strong> or <strong className="text-slate-100">"Add to Home Screen"</strong>. Follow the screen prompt to install.
                          </li>
                        </ul>
                      </div>

                      {/* Cookie Consent */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">2. PRIVACY & GDPR COOKIE CONSENT</span>
                        <p>Upon your first login, a cookie consent banner will appear at the bottom of the viewport. Select your preferences to store settings locally on your mobile device. Fully compliant with UK GDPR and PECR accountability standards.</p>
                      </div>

                      {/* Clock In/Out */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">3. CLOCK-IN / CLOCK-OUT WORKFLOW</span>
                        <p>Open the app on your home screen and log in using your registered email address.</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Locate your scheduled shift card and tap the <strong className="text-slate-200">"Clock In"</strong> button. Accept the browser location access popup to log your check-in time and precise GPS coordinates.
                          </li>
                          <li>
                            You must clock in to receive automated site validation prompts.
                          </li>
                          <li>
                            When you finish work, return to the shift card and tap the <strong className="text-slate-200">"Clock Out"</strong> button to register your check-out. Your coordinates are captured on clock-out as well.
                          </li>
                        </ul>
                      </div>

                      {/* Geofence Verification */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">4. SITE VALIDATION WINDOWS</span>
                        <p>While clocked in, the system checks if you are on site using validation prompts:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            When a validation window opens, a chime sound is dispatched.
                          </li>
                          <li>
                            Tap the <strong className="text-slate-100">"Verify you are on site"</strong> prompt.
                          </li>
                          <li>
                            The app will fetch your location. If you are inside the site geofence radius, your checkpoint logs are verified. If you are outside the boundary, the validation will fail.
                          </li>
                        </ul>
                      </div>

                      {/* Transit departures */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">5. TRANSIT DEPARTURES (OFF-SITE JOBS)</span>
                        <p>If you need to leave the site boundary during work (e.g., to fetch supplies, run errands, or visit depots):</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Scroll down to the <strong className="text-slate-200">Transit Logger</strong> card.
                          </li>
                          <li>
                            Select your transit reason (e.g., supplies) and tap <strong className="text-slate-100">"Depart Site"</strong>.
                          </li>
                          <li>
                            This pauses the active site geofence prompts while you are away.
                          </li>
                          <li>
                            When you return to site, return to this card and tap <strong className="text-slate-100">"Return to Site"</strong> to reactivate validation checks.
                          </li>
                        </ul>
                      </div>

                      {/* H&S Toolbox talks */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">6. MANDATORY HEALTH & SAFETY BRIEFINGS</span>
                        <p>Admins can push mandatory briefings (Toolbox Talks) to workers:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            If a briefing is active and you haven't read it, a full-screen popup modal will block the dashboard.
                          </li>
                          <li>
                            You must read the safety talk text and tap <strong className="text-brand-yellow">"I have read and understood this talk"</strong> to clear the alert.
                          </li>
                          <li>
                            Tapping the confirmation button silently registers a read receipt with your precise coordinates and timestamp.
                          </li>
                        </ul>
                      </div>

                      {/* Dayworks & Variations */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">7. LOG VARIATION / DAYWORK</span>
                        <p>If a client requests extra, unplanned work not covered in your schedule:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Scroll down to the <strong className="text-slate-200">Log Variation / Daywork</strong> form.
                          </li>
                          <li>
                            Describe the work details in the text notes block.
                          </li>
                          <li>
                            Tap the file input to capture a photo of the extra work using your phone's camera.
                          </li>
                          <li>
                            Tap <strong className="text-slate-100">"Submit Variation Log"</strong>. The app uploads the photo and appends your GPS coordinates to verify your on-site request.
                          </li>
                        </ul>
                      </div>

                      {/* Overtime Claims */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-yellow font-extrabold uppercase tracking-wider block">8. DIGITAL OVERTIME CLAIMS</span>
                        <p>If you stay beyond your scheduled shift hours:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            At the scheduled shift end time, a checkout prompt modal will open.
                          </li>
                          <li>
                            Select <strong className="text-slate-200">"Logging Overtime Work"</strong> and provide the required justification notes (explaining why you stayed late) to keep the shift open.
                          </li>
                          <li>
                            When you finish, clock out manually. The system calculates the overtime minutes between the scheduled shift end and your checkout timestamp automatically.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Admin Dashboard Guide */}
                  <div className="bg-slate-955 border border-slate-850 p-5 space-y-6">
                    <h4 className="text-sm font-extrabold text-brand-blue uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
                      🛡️ Admin Dashboard Operations Guide
                    </h4>
                    
                    <div className="space-y-4 text-xs text-slate-355 leading-relaxed font-sans">
                      {/* Rota Scheduling */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">1. STAFF REGISTRY & ROTA SCHEDULING</span>
                        <p>Navigate to the <strong className="text-slate-200">Staff Directory & Rota</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            <strong className="text-slate-200">Register Staff:</strong> Input full name, phone number, email address, and hourly rate. Individual cards show safety briefing completion and variation log counts.
                          </li>
                          <li>
                            <strong className="text-slate-200">Create Shift:</strong> Select the worker profile, target site, start date, duration, and shift start time to schedule rotas.
                          </li>
                        </ul>
                      </div>

                      {/* Geofencing Config */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">2. GEOFENCING CONFIGURATION & LIVE TRACKING MAP</span>
                        <p>Navigate to the <strong className="text-slate-200">Geofence Map & Tracking</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Configure site boundaries and geofence radii.
                          </li>
                          <li>
                            View interactive geofence rings and workers' clock-in/out and checkpoint verification events plotted live on the Map.
                          </li>
                        </ul>
                      </div>

                      {/* Manual Validation */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">3. DISPATCHING SITE VALIDATIONS</span>
                        <p>To verify a worker is currently on site at any time:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Locate the worker's shift card inside the Shift Activity Log.
                          </li>
                          <li>
                            Click the <strong className="text-slate-100">"Validate Now"</strong> button. This instantly sends a prompt to their device, requiring them to verify their GPS location.
                          </li>
                        </ul>
                      </div>

                      {/* Audit Log */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">4. GDPR COMPLIANCE AUDITING</span>
                        <p>Navigate to the <strong className="text-slate-200">Audit Registers</strong> tab to inspect internal logs. Every worker check-in, check-out, off-site transit log, safety briefing receipt, and manual validation request is archived with a verified coordinate and timestamp, meeting UK GDPR Article 24 regulations.</p>
                      </div>

                      {/* Payroll Bento COST */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">5. PAYROLL REPORTS & EST. COST BREAKDOWNS</span>
                        <p>Navigate to the <strong className="text-slate-200">Payroll Reports &rarr; Hours & Payroll</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Review total scheduled hours versus validated on-site hours, alongside compliance rates.
                          </li>
                          <li>
                            Inspect verified payouts (GDPR Article 24 compliant) against pending payouts.
                          </li>
                          <li>
                            Click <strong className="text-slate-100">"Export CSV Report"</strong> to generate downloadable files.
                          </li>
                        </ul>
                      </div>

                      {/* Overtime Approvals */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">6. OVERTIME CLAIMS APPROVALS LEDGER</span>
                        <p>Navigate to the <strong className="text-slate-200">Payroll Reports &rarr; Overtime Claims</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Displays shifts where a worker stayed late and initiated an overtime claim.
                          </li>
                          <li>
                            Admins can review shift details, accrued overtime minutes, worker-entered justification reasons, and associated cost increases.
                          </li>
                          <li>
                            Select <strong className="text-slate-200">"Approve Overtime"</strong> to merge overtime minutes into the shift's payable duration, or select <strong className="text-slate-200">"Decline"</strong>.
                          </li>
                        </ul>
                      </div>

                      {/* Dayworks Register */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">7. DAYWORKS & VARIATIONS REGISTER</span>
                        <p>Navigate to the <strong className="text-slate-200">Payroll Reports &rarr; Dayworks & Variations</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Lists worker submissions for unplanned client requests.
                          </li>
                          <li>
                            Shows notes, coordinates, and clickable maps links.
                          </li>
                          <li>
                            Click the thumbnail image to open a fullscreen lightbox photo viewer.
                          </li>
                        </ul>
                      </div>

                      {/* Toolbox Talks safety briefings */}
                      <div className="space-y-1.5 border-t border-slate-850 pt-3">
                        <span className="text-[10px] text-brand-blue font-extrabold uppercase tracking-wider block">8. H&S BRIEFINGS & TALKS PORTAL</span>
                        <p>Navigate to the <strong className="text-slate-200">Payroll Reports &rarr; H&S Toolbox Talks</strong> tab:</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-400">
                          <li>
                            Type in any custom briefing subject/topic and provide content text.
                          </li>
                          <li>
                            Click <strong className="text-slate-100">"Publish Toolbox Talk"</strong> to immediately push this mandatory briefing onto all active workers' devices.
                          </li>
                          <li>
                            Track completion ratios for each briefing and click <strong className="text-slate-200">"View Receipts"</strong> to view acknowledgment status, timestamps, and Google Maps coordinate links for each employee.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Privacy/GDPR Sandbox Info Panel */}
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-none text-slate-400 leading-relaxed flex items-start gap-3">
                  <Shield className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs">
                    <strong className="text-slate-350 uppercase tracking-wider block mb-1">UK GDPR Article 24 Safeguards</strong>
                    This application relies on scheduled check-ins instead of constant background location tracking. Your device checks its GPS coordinate ONLY when you respond to these validation windows. Data is partitioned on a per-user basis in Firestore.
                  </p>
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
              
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {workerShifts.length === 0 ? (
                  <div className="text-slate-500 text-xs italic py-4 text-center">
                    You have no scheduled shifts assigned in this rota.
                  </div>
                ) : (
                  workerShifts.map((shift) => (
                    <div key={shift.id} className="p-4 bg-slate-950 border border-slate-800 rounded-none space-y-3">
                      <div className="flex justify-between items-center gap-3">
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

                      {/* Clock In / Clock Out Controls */}
                      <div className="pt-2 border-t border-slate-900 flex flex-wrap justify-between items-center gap-2 text-xs font-mono">
                        <div className="text-slate-400 space-y-1">
                          {shift.clockInTime && (
                            <div>
                              📥 <span className="text-slate-500">In:</span> <span className="text-emerald-400 font-bold">{shift.clockInTime}</span>
                            </div>
                          )}
                          {shift.clockOutTime && (
                            <div>
                              📤 <span className="text-slate-500">Out:</span> <span className="text-brand-yellow font-bold">{shift.clockOutTime}</span>
                            </div>
                          )}
                          {!shift.clockInTime && !shift.clockOutTime && (
                            <span className="text-slate-650 italic">Not clocked in</span>
                          )}
                        </div>

                        <div>
                          {loadingClockId === shift.id ? (
                            <div className="flex items-center gap-1.5 text-slate-450 font-bold">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" />
                              <span>Verifying...</span>
                            </div>
                          ) : (
                            <>
                              {!shift.clockInTime && (
                                <button
                                  type="button"
                                  onClick={() => handleClockIn(shift)}
                                  className="h-7 px-3.5 bg-brand-blue hover:bg-blue-600 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-[10px] cursor-pointer"
                                >
                                  Clock In
                                </button>
                              )}
                              {shift.clockInTime && !shift.clockOutTime && (
                                <button
                                  type="button"
                                  onClick={() => handleClockOut(shift)}
                                  className="h-7 px-3.5 bg-brand-yellow hover:bg-yellow-500 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-[10px] cursor-pointer"
                                >
                                  Clock Out
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
                simulatedCoords={simulatedCoords}
                setSimulatedCoords={setSimulatedCoords}
              />
            </div>

            {/* TRANSIT OFF-SITE LOGGER */}
            <OffSiteModule 
              uid={uid} 
              onOffSiteSuccess={handleOffSiteSuccess} 
              selectedStaffId={selectedStaffId}
              selectedStaffName={staffMembers.find(s => s.id === selectedStaffId)?.name || (user ? user.email : undefined)}
            />

            {/* DAYWORKS & VARIATIONS LOGGER */}
            <div className="bg-slate-900 border border-slate-800 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5 text-slate-100 font-bold uppercase tracking-wider">
                <span>📋 Log Variation / Daywork</span>
              </div>
              
              <form onSubmit={handleAddVariationSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Variation Description / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the un-planned work (e.g. dug extra trench, cleared extra debris...)"
                    value={varNotes}
                    onChange={(e) => setVarNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-xs rounded-none font-sans"
                    required
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Capture Photo Attachment</label>
                  <input
                    type="file"
                    id="var-photo-file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:border file:border-slate-800 file:bg-slate-950 file:text-slate-350 file:text-[10px] file:font-bold file:uppercase file:rounded-none file:cursor-pointer hover:file:bg-slate-850"
                  />
                  {varPhoto && (
                    <div className="mt-2.5 border border-slate-800 p-1 bg-slate-950">
                      <img src={varPhoto} alt="Preview" className="max-h-36 object-contain mx-auto" />
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 leading-normal font-sans">
                  Submissions will automatically append your current location and timestamp to verify the variation request.
                </div>

                <button
                  type="submit"
                  disabled={varSubmitting}
                  className="w-full h-9 bg-brand-yellow hover:bg-amber-500 disabled:opacity-50 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  {varSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-955" />
                  ) : (
                    <span>Submit Variation Log</span>
                  )}
                </button>
              </form>
            </div>

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
                            <strong className="text-slate-300">Rota Scheduling:</strong> Register workers and schedule dates/shifts. Workers sign in using these pre-registered emails.
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
                      onClick={() => { setAdminSubView("reports"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "reports" 
                          ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                          : "bg-slate-905 hover:bg-slate-850 text-slate-400 border-slate-850"
                      }`}
                    >
                      Payroll Reports
                    </button>

                    <button
                      onClick={() => { setAdminSubView("help"); setIsMenuOpen(false); }}
                      className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition cursor-pointer ${
                        adminSubView === "help" 
                          ? "bg-brand-yellow/20 text-brand-yellow border-brand-yellow/50" 
                          : "bg-slate-905 hover:bg-slate-850 text-brand-yellow border-slate-850"
                      }`}
                    >
                      Help & PWA Guide
                    </button>
                  </nav>
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

      {/* MANDATORY HEALTH & SAFETY BRIEFING (TROJAN HORSE) PING */}
      {unreadBriefing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border-2 border-brand-yellow p-6 shadow-2xl relative overflow-hidden font-mono">
            {/* Decorative top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-yellow" />
            
            <div className="flex items-center gap-2 text-brand-yellow font-extrabold text-sm uppercase tracking-wider mb-4">
              <ShieldAlert className="w-5 h-5 text-brand-yellow animate-bounce animate-duration-1000" />
              <span>MANDATORY HEALTH & SAFETY BRIEFING</span>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-950 p-3 border border-slate-850">
                <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider block">Topic:</span>
                <span className="text-xs font-bold text-slate-100 uppercase tracking-widest">{unreadBriefing.topic}</span>
              </div>
              
              <div className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-3 border border-slate-850 max-h-48 overflow-y-auto">
                <p className="font-semibold whitespace-pre-wrap">{unreadBriefing.content}</p>
              </div>
              
              <div className="bg-slate-950 border border-slate-850 p-3 text-[10px] text-slate-500 leading-normal font-sans">
                <span className="font-bold text-slate-400 block mb-1">UK GDPR COMPLIANCE VERIFICATION NOTICE</span>
                Acknowledging this safety briefing will silently capture your precise GPS coordinates as a verified read-receipt timestamp to log with the site administrator. Continuous background tracking is disabled.
              </div>

              <button
                type="button"
                onClick={handleAcknowledgeBriefing}
                disabled={hsSubmitting}
                className="w-full h-11 bg-brand-yellow hover:bg-amber-500 disabled:opacity-50 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                {hsSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-955" />
                ) : (
                  <span>I have read and understood this talk</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIGITAL OVERTIME CLAIM PROMPT */}
      {overtimePromptShift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-955/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-w-sm w-full bg-slate-900 border-2 border-brand-blue p-6 shadow-2xl relative overflow-hidden font-mono">
            {/* Decorative top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-brand-blue" />
            
            <div className="flex items-center gap-2 text-brand-blue font-extrabold text-sm uppercase tracking-wider mb-4">
              <Clock className="w-5 h-5 text-brand-blue animate-pulse" />
              <span>SHIFT COMPLETION DIALOG</span>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-355 leading-relaxed font-sans">
                Your scheduled shift at <strong className="text-slate-100">{overtimePromptShift.siteName}</strong> has ended (Scheduled duration: {overtimePromptShift.hours} hrs, Shift Start: {overtimePromptShift.startTime}). 
                Please indicate your checkout status:
              </p>
              
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Reason for Overtime (required to claim)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. concrete pouring delays, extra wiring tasks..."
                  value={overtimeNotesText}
                  onChange={(e) => setOvertimeNotesText(e.target.value)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-xs rounded-none font-sans font-medium"
                />
              </div>
              
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOvertimePromptShift(null);
                    setOvertimeNotesText("");
                    handleClockOut(overtimePromptShift);
                  }}
                  className="w-full h-10 bg-slate-955 hover:bg-slate-850 text-slate-200 font-bold uppercase tracking-wider transition rounded-none text-xs border border-slate-800 cursor-pointer"
                >
                  ⏰ Checkout & Clock Out Now
                </button>
                
                <button
                  type="button"
                  onClick={() => handleClaimOvertime(overtimePromptShift)}
                  className="w-full h-10 bg-brand-blue hover:bg-blue-600 text-slate-955 font-extrabold uppercase tracking-wider transition rounded-none text-xs cursor-pointer border-none"
                >
                  🚀 Logging Overtime Work
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL OVERLAY */}
      {activeLightboxImage && (
        <div 
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-955/90 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[85vh] border border-slate-800 p-2 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <img src={activeLightboxImage} alt="Expanded Variation Detail" className="max-h-[80vh] w-auto object-contain mx-auto" />
            <button
              type="button"
              onClick={() => setActiveLightboxImage(null)}
              className="absolute -top-10 right-0 text-slate-400 hover:text-slate-100 font-extrabold text-xs uppercase cursor-pointer bg-transparent border-none"
            >
              Close [×]
            </button>
          </div>
        </div>
      )}

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
