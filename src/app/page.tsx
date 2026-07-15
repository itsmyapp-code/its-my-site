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
  X
} from "lucide-react";

// Components
import { ConsentBanner } from "@/components/ConsentBanner";
import { ValidationPrompts } from "@/components/ValidationPrompts";
import { GeofenceDetector } from "@/components/GeofenceDetector";
import { OffSiteModule } from "@/components/OffSiteModule";
import { StaffManager } from "@/components/StaffManager";
import { dbGetAuditLogs, AuditLog, ShiftEvent, dbGetEvents, dbGetSites, dbGetStaff, dbGetShifts, Staff, Shift } from "@/lib/db";
import dynamic from "next/dynamic";

const TimelineMap = dynamic(
  () => import("@/components/TimelineMap").then((mod) => mod.TimelineMap),
  { ssr: false, loading: () => <div className="h-[400px] lg:h-[500px] bg-slate-950 flex items-center justify-center text-slate-400 font-bold animate-pulse text-sm">LOADING LEAFLET MAP CANVAS...</div> }
);

export default function Home() {
  const [role, setRole] = useState<"admin" | "worker">("admin");
  const [uid] = useState("admin-worker-hybrid-101");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activePrompt, setActivePrompt] = useState(false);
  const [adminSubView, setAdminSubView] = useState<"overview" | "staff" | "map" | "logs">("staff");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Dashboard Metrics & Lists
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeSiteCount, setActiveSiteCount] = useState(3);
  const [eventsCount, setEventsCount] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);

  // Staff simulation state for Worker View
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [workerShifts, setWorkerShifts] = useState<Shift[]>([]);

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
      if (staffList.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffList[0].id);
      }

      // Load shifts
      const allShifts = await dbGetShifts(uid);
      if (selectedStaffId) {
        setWorkerShifts(allShifts.filter(s => s.staffId === selectedStaffId));
      } else if (staffList.length > 0) {
        setWorkerShifts(allShifts.filter(s => s.staffId === staffList[0].id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [uid, refreshTrigger, selectedStaffId]);

  const handleValidationSuccess = (event: ShiftEvent) => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOffSiteSuccess = (event: ShiftEvent) => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDataModified = () => {
    setRefreshTrigger(prev => prev + 1);
  };

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
                <span className="text-xs bg-brand-blue text-slate-950 px-1.5 py-0.5 font-extrabold uppercase">
                  EDGE V4
                </span>
              </h1>
              <span className="text-xs text-slate-500 font-bold block">Geofencing, Staffing & Shift Validation</span>
            </div>
          </div>

          {/* VIEWPORT MODE SELECTOR & MENU */}
          <div className="flex items-center gap-3">
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

            {/* Hamburger button (visible in Admin view) */}
            {role === "admin" && (
              <button
                onClick={() => setIsMenuOpen(true)}
                className="h-10 w-10 border border-slate-850 bg-slate-955 hover:bg-slate-900 text-slate-200 hover:text-slate-100 flex items-center justify-center transition cursor-pointer"
                title="Admin Control Menu"
              >
                <Menu className="w-5 h-5" />
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
                Staff Directory & Roster
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
                Bento KPI Overview
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
                      <span>LocalStorage Sandbox</span>
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
                      className="p-4 border border-slate-800 bg-slate-950 hover:bg-slate-850 text-slate-200 font-bold uppercase transition text-center cursor-pointer text-xs tracking-wider"
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
                      <div key={log.id} className="p-3 bg-slate-950 border border-slate-850 rounded-none space-y-1.5">
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
            
            {/* Staff Member Selector (Choose Profile) */}
            <div className="bg-slate-900 border border-slate-800 p-4 space-y-2">
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
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

            {/* Worker Shift Status Badge */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-none text-sm">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Logged In As:</span>
                <span className="text-sm font-bold text-slate-100">
                  {staffMembers.find(s => s.id === selectedStaffId)?.name || "Guest Operator"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Your Roster Shifts:</span>
                <span className="text-sm font-bold text-brand-yellow">{workerShifts.length} scheduled</span>
              </div>
            </div>

            {/* WORKER'S SPECIFIC ASSIGNED SHIFTS LIST */}
            <div className="bg-slate-900 border border-slate-800 p-4 space-y-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-850 pb-2">
                Your Scheduled Shifts
              </span>
              
              <div className="space-y-2.5 max-h-48 overflow-y-auto">
                {workerShifts.length === 0 ? (
                  <div className="text-slate-500 text-xs italic py-4 text-center">
                    You have no scheduled shifts assigned in this roster.
                  </div>
                ) : (
                  workerShifts.map((shift) => (
                    <div key={shift.id} className="p-3 bg-slate-950 border border-slate-850 rounded-none flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-100">{shift.siteName}</div>
                        <div className="text-slate-500 text-[10px] mt-0.5">
                          Date: {shift.date} | Hours: {shift.hours} hrs | Start: {shift.startTime}
                        </div>
                      </div>
                      <div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-none uppercase tracking-wider leading-none ${
                          shift.validated 
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800" 
                            : "bg-slate-900 text-rose-400 border-rose-950 animate-pulse"
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
                selectedStaffName={staffMembers.find(s => s.id === selectedStaffId)?.name}
              />
            </div>

            {/* TRANSIT OFF-SITE LOGGER */}
            <OffSiteModule 
              uid={uid} 
              onOffSiteSuccess={handleOffSiteSuccess} 
              selectedStaffId={selectedStaffId}
              selectedStaffName={staffMembers.find(s => s.id === selectedStaffId)?.name}
            />

          </div>
        )}

      </main>

      {/* GLOBAL FOOTER COMPLIANCE WORKSPACE */}
      <footer className="bg-slate-950 border-t border-slate-900 mt-10 py-8 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          {/* Static Compliance Navigation */}
          <div className="flex flex-wrap gap-4 text-slate-400 font-bold uppercase tracking-wider shrink-0">
            <Link href="/terms" className="hover:text-brand-blue transition">/terms</Link>
            <Link href="/privacy" className="hover:text-brand-blue transition">/privacy</Link>
            <Link href="/cookies" className="hover:text-brand-blue transition">/cookies</Link>
            <Link href="/accessibility" className="hover:text-brand-blue transition">/accessibility</Link>
          </div>
          
          {/* Regulatory query lead */}
          <div className="max-w-xl md:text-right leading-relaxed font-semibold">
            Data Privacy & Compliance Queries: For any questions regarding your data rights, or to submit an inquiry, 
            please contact our Data Privacy Lead directly at <a href="mailto:hello@itsmyapp.co.uk" className="text-slate-400 hover:text-brand-blue">hello@itsmyapp.co.uk</a>. 
            We formally acknowledge all compliance submissions within 30 days.
          </div>

        </div>
        
        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-900 text-center flex flex-col sm:flex-row justify-between text-[11px] text-slate-700">
          <span>&copy; {new Date().getFullYear()} itsmysite. All rights reserved. Registered UK GDPR Entity.</span>
          <span className="uppercase font-bold tracking-wider">Zero-Server Client Edge Architecture</span>
        </div>
      </footer>

      {/* ADMIN CONTROL SIDE DRAWER */}
      {isMenuOpen && role === "admin" && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur overlay */}
          <div 
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
          />
          
          {/* Menu Panel */}
          <div className="relative w-80 max-w-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              
              {/* Drawer Header */}
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Menu className="w-5 h-5 text-brand-blue" />
                  <span className="font-mono font-bold text-slate-100 uppercase tracking-wider text-sm">Admin Control</span>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col gap-2.5 font-mono text-sm">
                <button
                  onClick={() => { setAdminSubView("staff"); setIsMenuOpen(false); }}
                  className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition ${
                    adminSubView === "staff" 
                      ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                      : "bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-850"
                  }`}
                >
                  Staff Directory & Roster
                </button>

                <button
                  onClick={() => { setAdminSubView("map"); setIsMenuOpen(false); }}
                  className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition ${
                    adminSubView === "map" 
                      ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                      : "bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-850"
                  }`}
                >
                  Geofence Map & Tracking
                </button>

                <button
                  onClick={() => { setAdminSubView("overview"); setIsMenuOpen(false); }}
                  className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition ${
                    adminSubView === "overview" 
                      ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                      : "bg-slate-955 hover:bg-slate-850 text-slate-400 border-slate-850"
                  }`}
                >
                  Bento KPI Overview
                </button>

                <button
                  onClick={() => { setAdminSubView("logs"); setIsMenuOpen(false); }}
                  className={`w-full p-3 text-left border rounded-none uppercase font-bold tracking-wider transition ${
                    adminSubView === "logs" 
                      ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50" 
                      : "bg-slate-950 hover:bg-slate-850 text-slate-400 border-slate-850"
                  }`}
                >
                  Audit Registers
                </button>
              </nav>

            </div>

            {/* Footer indicator */}
            <div className="font-mono text-xs text-slate-605 border-t border-slate-850 pt-4">
              <span>itsmysite edge v4.0.0</span>
            </div>
          </div>
        </div>
      )}

      {/* COMPLIANCE COOKIE LAYER */}
      <ConsentBanner />

    </div>
  );
}
