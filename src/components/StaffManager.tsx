"use client";

import React, { useState, useEffect } from "react";
import { 
  dbGetStaff, 
  dbAddStaff, 
  dbDeleteStaff, 
  dbGetShifts, 
  dbAddShift, 
  dbDeleteShift, 
  dbGetSites, 
  Site, 
  Staff, 
  Shift, 
  dbAddAuditLog 
} from "@/lib/db";
import { 
  Users, 
  Calendar, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  UserCheck, 
  ShieldAlert 
} from "lucide-react";

interface StaffManagerProps {
  uid: string;
  refreshTrigger: number;
  onDataModified: () => void;
}

export function StaffManager({ uid, refreshTrigger, onDataModified }: StaffManagerProps) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMsg, setFormMsg] = useState("");

  // Staff Form state
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRate, setStaffRate] = useState("15.00");

  // Shift Form state
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftStartTime, setShiftStartTime] = useState("09:00");
  const [shiftHours, setShiftHours] = useState("8");

  const loadData = async () => {
    try {
      const staffData = await dbGetStaff(uid);
      const shiftData = await dbGetShifts(uid);
      const siteData = await dbGetSites(uid);
      
      setStaffList(staffData);
      setShifts(shiftData);
      setSites(siteData);

      // Pre-select first values in dropdowns if available
      if (staffData.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffData[0].id);
      }
      if (siteData.length > 0 && !selectedSiteId) {
        setSelectedSiteId(siteData[0].id);
      }
    } catch (err) {
      console.error("Error loading staff data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [uid, refreshTrigger]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffPhone || !staffRate) {
      setFormMsg("Please enter all staff details.");
      return;
    }

    const rateNum = parseFloat(staffRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      setFormMsg("Please enter a valid hourly rate.");
      return;
    }

    try {
      const newStaffId = await dbAddStaff(uid, {
        name: staffName,
        phone: staffPhone,
        hourlyRate: rateNum
      });

      await dbAddAuditLog(
        uid,
        "STAFF_MEMBER_CREATED",
        `Created staff profile for ${staffName} (${staffPhone}) at £${rateNum.toFixed(2)}/hr.`
      );

      setStaffName("");
      setStaffPhone("");
      setStaffRate("15.00");
      setFormMsg("Staff member added successfully.");
      setTimeout(() => setFormMsg(""), 3000);
      
      // Reload
      await loadData();
      onDataModified();
    } catch (err) {
      console.error(err);
      setFormMsg("Error adding staff member.");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove staff member "${name}"?`)) {
      try {
        await dbDeleteStaff(uid, id);
        await dbAddAuditLog(uid, "STAFF_MEMBER_DELETED", `Deleted staff profile: ${name} (ID: ${id})`);
        
        await loadData();
        onDataModified();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId || !selectedSiteId || !shiftDate || !shiftStartTime || !shiftHours) {
      setFormMsg("Please complete all shift scheduling details.");
      return;
    }

    const hoursNum = parseFloat(shiftHours);
    if (isNaN(hoursNum) || hoursNum <= 0) {
      setFormMsg("Shift duration must be a valid number of hours.");
      return;
    }

    const staff = staffList.find(s => s.id === selectedStaffId);
    const site = sites.find(s => s.id === selectedSiteId);

    if (!staff || !site) {
      setFormMsg("Selected staff or site is invalid.");
      return;
    }

    try {
      await dbAddShift(uid, {
        staffId: selectedStaffId,
        staffName: staff.name,
        siteId: selectedSiteId,
        siteName: site.name,
        date: shiftDate,
        startTime: shiftStartTime,
        hours: hoursNum,
        validated: false
      });

      await dbAddAuditLog(
        uid,
        "SHIFT_SCHEDULED",
        `Scheduled ${hoursNum}hr shift for ${staff.name} at ${site.name} on ${shiftDate} starting at ${shiftStartTime}.`
      );

      setShiftDate("");
      setFormMsg("Shift scheduled successfully.");
      setTimeout(() => setFormMsg(""), 3000);

      await loadData();
      onDataModified();
    } catch (err) {
      console.error(err);
      setFormMsg("Error scheduling shift.");
    }
  };

  const handleDeleteShift = async (id: string, staffName: string, siteName: string) => {
    if (confirm(`Remove scheduled shift for ${staffName} at ${siteName}?`)) {
      try {
        await dbDeleteShift(uid, id);
        await dbAddAuditLog(uid, "SHIFT_DELETED", `Removed shift ID: ${id} (Staff: ${staffName}, Site: ${siteName})`);
        
        await loadData();
        onDataModified();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Calculate totals
  const totalScheduledHours = shifts.reduce((sum, s) => sum + s.hours, 0);
  const totalValidatedHours = shifts.reduce((sum, s) => sum + (s.validated ? s.hours : 0), 0);
  
  const payrollDetails = shifts.reduce((acc, shift) => {
    const staff = staffList.find(s => s.id === shift.staffId);
    const rate = staff ? staff.hourlyRate : 15.00;
    const pay = shift.hours * rate;
    
    if (shift.validated) {
      acc.validatedPay += pay;
    } else {
      acc.pendingPay += pay;
    }
    return acc;
  }, { validatedPay: 0, pendingPay: 0 });

  const totalPayroll = payrollDetails.validatedPay + payrollDetails.pendingPay;

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-none animate-pulse h-64 flex items-center justify-center">
        <span className="text-slate-400 font-mono text-sm">LOADING STAFF DIRECTORY ENGINE...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 font-mono text-sm text-slate-350">
      
      {/* 1. DIRECTORY & SCHEDULER FORMS (Col: 5) */}
      <div className="xl:col-span-5 space-y-6">
        
        {/* Staff Directory Panel */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2.5">
            <Users className="w-5 h-5 text-brand-blue" />
            <span>Staff Directory</span>
          </h3>

          <form onSubmit={handleAddStaff} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 07700 900077"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Hourly Rate (£/hr)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="15.00"
                  value={staffRate}
                  onChange={(e) => setStaffRate(e.target.value)}
                  className="h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none grow text-sm"
                  required
                />
                <button
                  type="submit"
                  className="h-9 px-5 bg-brand-blue hover:bg-blue-600 text-slate-950 font-bold uppercase tracking-wider text-center cursor-pointer transition rounded-none shrink-0 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Add Staff
                </button>
              </div>
            </div>
          </form>

          {/* Staff directory list */}
          <div className="pt-2 border-t border-slate-850 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Registered Staff ({staffList.length})</span>
            <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-slate-850 pr-1">
              {staffList.map((staff) => (
                <div key={staff.id} className="flex justify-between items-center py-2 text-sm">
                  <div>
                    <span className="font-bold text-slate-100">{staff.name}</span>
                    <span className="text-slate-500 font-medium block text-xs">
                      Phone: {staff.phone} | Rate: £{staff.hourlyRate.toFixed(2)}/hr
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteStaff(staff.id, staff.name)}
                    className="p-1.5 hover:bg-slate-850 text-slate-500 hover:text-brand-red rounded transition cursor-pointer"
                    title="Remove staff member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shift Scheduler Panel */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2.5">
            <Calendar className="w-5 h-5 text-brand-yellow" />
            <span>Shift Scheduler</span>
          </h3>

          <form onSubmit={handleAddShift} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Select Staff</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  required
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (£{s.hourlyRate.toFixed(2)}/hr)</option>
                  ))}
                  {staffList.length === 0 && <option value="">No Staff Registered</option>}
                </select>
              </div>
              
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Select Geofence Site</label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  required
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (R: {s.radius}m)</option>
                  ))}
                  {sites.length === 0 && <option value="">No Sites Configured</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Shift Date</label>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Hours</label>
                <input
                  type="number"
                  placeholder="8"
                  value={shiftHours}
                  onChange={(e) => setShiftHours(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none text-sm"
                  min="0.5"
                  max="24"
                  step="0.5"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Start Time</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue rounded-none grow text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={staffList.length === 0 || sites.length === 0}
                  className="h-9 px-5 bg-brand-yellow hover:bg-amber-500 text-slate-950 font-bold uppercase tracking-wider text-center cursor-pointer transition rounded-none shrink-0 text-sm disabled:opacity-50"
                >
                  Schedule Shift
                </button>
              </div>
            </div>
          </form>
          
          {formMsg && <div className="text-sm text-brand-yellow font-bold animate-pulse">{formMsg}</div>}
        </div>

      </div>

      {/* 2. SHIFTS LIST & PAYROLL REPORT (Col: 7) */}
      <div className="xl:col-span-7 space-y-6">
        
        {/* Hours & Payroll Bento Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-brand-blue" />
          
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2.5">
            <DollarSign className="w-5 h-5 text-brand-blue" />
            <span>Shift Hours & Estimated Payroll Report</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950 p-4 border border-slate-850 text-sm">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Scheduled Hours</span>
              <div className="text-2xl font-extrabold text-slate-200">{totalScheduledHours.toFixed(1)} hrs</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Validated Hours</span>
              <div className="text-2xl font-extrabold text-brand-blue">{totalValidatedHours.toFixed(1)} hrs</div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Total Estimated Pay</span>
              <div className="text-2xl font-extrabold text-brand-yellow">£{totalPayroll.toFixed(2)}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm leading-normal">
            <div className="flex justify-between border-b border-slate-850 pb-1.5 text-slate-400">
              <span>Verified / Validated Payroll (Geofenced Approved)</span>
              <span className="font-bold text-emerald-400">£{payrollDetails.validatedPay.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-850 pb-1.5 text-slate-400">
              <span>Unverified / Pending Payroll (Off-Site/Unlogged)</span>
              <span className="font-bold text-rose-400">£{payrollDetails.pendingPay.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Scheduled Shifts Roster List */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4 flex flex-col h-[340px] xl:h-[352px]">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-2.5">
            <Clock className="w-5 h-5 text-brand-yellow" />
            <span>Scheduled Shifts Roster</span>
          </h3>

          <div className="overflow-y-auto grow space-y-2.5 pr-1 text-sm">
            {shifts.length === 0 ? (
              <div className="text-slate-500 italic py-10 text-center">No shifts scheduled in this roster.</div>
            ) : (
              shifts.map((shift) => {
                const staffMember = staffList.find(s => s.id === shift.staffId);
                const rate = staffMember ? staffMember.hourlyRate : 15.00;
                const estimatedCost = shift.hours * rate;

                return (
                  <div key={shift.id} className="p-3 bg-slate-950 border border-slate-850 rounded-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100 text-sm">{shift.staffName}</span>
                        <span className="px-2 py-0.5 text-[9px] font-bold border rounded-none uppercase tracking-wider leading-none bg-slate-900 text-slate-400 border-slate-800">
                          {shift.hours} hrs
                        </span>
                      </div>
                      
                      <div className="text-slate-400 text-xs">
                        Site: <strong className="text-slate-300">{shift.siteName}</strong>
                      </div>
                      
                      <div className="text-[10px] text-slate-500">
                        Date: {shift.date} | Start: {shift.startTime} | Rate: £{rate.toFixed(2)}/hr
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-end border-t border-slate-900 sm:border-t-0 pt-2 sm:pt-0">
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-brand-yellow">£{estimatedCost.toFixed(2)}</div>
                        <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-none uppercase tracking-wider leading-none block mt-1 ${
                          shift.validated 
                            ? "bg-emerald-950 text-emerald-400 border-emerald-800" 
                            : "bg-slate-900 text-rose-400 border-rose-950"
                        }`}>
                          {shift.validated ? "VALIDATED" : "UNVERIFIED"}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteShift(shift.id, shift.staffName, shift.siteName)}
                        className="p-1.5 hover:bg-slate-850 text-slate-500 hover:text-brand-red rounded transition cursor-pointer"
                        title="Delete shift"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
