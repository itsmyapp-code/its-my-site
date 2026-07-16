"use client";

import React, { useState, useEffect } from "react";
import { Bell, BellRing, AlertCircle, CheckCircle, Shield } from "lucide-react";
import { dbAddAuditLog, dbAddEvent } from "@/lib/db";

interface ValidationPromptsProps {
  uid: string;
  role: "admin" | "worker";
  onOpenValidation: () => void;
  activePrompt: boolean;
  setActivePrompt: (val: boolean) => void;
}

export function ValidationPrompts({ uid, role, onOpenValidation, activePrompt, setActivePrompt }: ValidationPromptsProps) {
  const [scheduledTimes, setScheduledTimes] = useState<string[]>(["10:00", "14:00", "17:30"]);
  const [newTime, setNewTime] = useState("");
  const [timerMsg, setTimerMsg] = useState("");

  // Play browser synthesised Web Audio API chime
  const playChime = () => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      // Chime 1 (High clean tone)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.35);
      
    } catch (e) {
      console.warn("Audio chime block by browser auto-play policy:", e);
    }
  };

  // Listen for scheduled times
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hours}:${minutes}`;

      if (scheduledTimes.includes(timeStr) && !activePrompt) {
        triggerPrompt(`Scheduled validation prompt triggered for ${timeStr}`);
      }
    }, 15000); // Check every 15s

    return () => clearInterval(interval);
  }, [scheduledTimes, activePrompt]);

  const triggerPrompt = async (reason: string) => {
    setActivePrompt(true);
    playChime();
    
    // Attempt standard browser notification if permitted
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("itsmysite - Validation Required", {
          body: "Are you on-site? Active shift verification is scheduled now.",
          icon: "/favicon.ico"
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }

    await dbAddAuditLog(uid, "VALIDATION_PROMPT_TRIGGERED", reason);
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTime) return;
    if (scheduledTimes.includes(newTime)) {
      setTimerMsg("Time already scheduled.");
      return;
    }
    const updated = [...scheduledTimes, newTime].sort();
    setScheduledTimes(updated);
    setNewTime("");
    setTimerMsg("Validation alarm added.");
    setTimeout(() => setTimerMsg(""), 3000);

    await dbAddAuditLog(uid, "VALIDATION_SCHEDULE_UPDATED", `Added scheduled prompt at ${newTime}`);
  };

  const handleRemoveSchedule = async (time: string) => {
    const updated = scheduledTimes.filter(t => t !== time);
    setScheduledTimes(updated);
    await dbAddAuditLog(uid, "VALIDATION_SCHEDULE_UPDATED", `Removed scheduled prompt at ${time}`);
  };

  const handleQuickTrigger = () => {
    triggerPrompt("Manual instant demonstration validation trigger.");
  };

  const handleDismissPrompt = async () => {
    setActivePrompt(false);
    await dbAddAuditLog(uid, "VALIDATION_PROMPT_DISMISSED", "User dismissed/deferred active validation prompt.");
  };

  if (role === "worker") {
    if (!activePrompt) return null;
    return (
      <div className="p-4 bg-amber-955/80 border-2 border-brand-yellow text-slate-100 space-y-3.5">
        <div className="flex items-center gap-2 text-brand-yellow font-bold text-sm">
          <BellRing className="w-5 h-5 text-brand-yellow animate-bounce" />
          <span>ACTION REQUIRED: SHIFT VALIDATION PROMPT</span>
        </div>
        <p className="text-sm leading-relaxed text-slate-200 font-semibold">
          Verify you are on site.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setActivePrompt(false);
              onOpenValidation();
            }}
            className="flex-1 h-10 bg-brand-yellow hover:bg-amber-500 text-slate-950 font-bold uppercase tracking-wider text-center cursor-pointer transition flex items-center justify-center rounded-none text-sm"
          >
            Verify Location
          </button>
          <button
            onClick={handleDismissPrompt}
            className="px-4 h-10 border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 uppercase font-bold text-xs cursor-pointer transition rounded-none"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 font-mono text-sm space-y-5">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand-yellow" />
          <span>Active Validation Dispatcher</span>
        </h3>
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">UK GDPR Safe-Track</span>
      </div>

      {/* active prompt warning modal-equivalent in grid */}
      {activePrompt ? (
        <div className="p-4 bg-amber-950/80 border-2 border-brand-yellow text-slate-100 space-y-3.5 animate-pulse">
          <div className="flex items-center gap-2 text-brand-yellow font-bold text-sm">
            <BellRing className="w-5 h-5 text-brand-yellow animate-bounce" />
            <span>ACTION REQUIRED: SHIFT VALIDATION PROMPT</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-200 font-semibold">
            Verify you are on site.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setActivePrompt(false);
                onOpenValidation();
              }}
              className="flex-1 h-10 bg-brand-yellow hover:bg-amber-500 text-slate-950 font-bold uppercase tracking-wider text-center cursor-pointer transition flex items-center justify-center rounded-none text-sm"
            >
              Verify Location
            </button>
            <button
              onClick={handleDismissPrompt}
              className="px-4 h-10 border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 uppercase font-bold text-xs cursor-pointer transition rounded-none"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 p-4 border border-slate-800 rounded-none text-slate-400 leading-relaxed flex items-start gap-3">
          <Shield className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs">
            <strong className="text-slate-350 uppercase tracking-wider block mb-1">Privacy Safeguard</strong>
            This application relies on scheduled check-ins instead of constant background location tracking. Your device checks its GPS coordinate ONLY when you respond to these validation windows.
          </p>
        </div>
      )}

      {/* Schedule controller */}
      <div className="space-y-2.5">
        <span className="text-xs text-slate-450 font-bold uppercase tracking-wider block">Scheduled Validation Checkpoints</span>
        
        {scheduledTimes.length === 0 ? (
          <div className="text-slate-655 text-xs italic">No validation checkpoints scheduled.</div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {scheduledTimes.map((time) => (
              <div 
                key={time} 
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 font-bold text-slate-300 rounded-none text-xs"
              >
                <span>{time}</span>
                <button
                  onClick={() => handleRemoveSchedule(time)}
                  className="text-slate-500 hover:text-brand-red font-extrabold ml-1 cursor-pointer"
                  title="Remove alarm"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add checkpoint Form */}
      <form onSubmit={handleAddSchedule} className="flex gap-2.5 items-center">
        <input
          type="time"
          value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold grow text-center rounded-none text-sm"
        />
        <button
          type="submit"
          className="h-10 px-4 border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900 active:bg-slate-850 font-bold uppercase text-xs cursor-pointer transition shrink-0 rounded-none"
        >
          Add Alarm
        </button>
      </form>
      
      {timerMsg && <div className="text-xs text-brand-yellow font-bold animate-pulse">{timerMsg}</div>}

      <div className="h-px bg-slate-800 my-2" />

      {/* Manual Instant Trigger for Tester */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">DEMONSTRATION TRIGGERS</span>
        <button
          onClick={handleQuickTrigger}
          className="w-full h-10 px-4 border border-slate-800 bg-slate-955/60 text-brand-yellow hover:text-slate-950 hover:bg-brand-yellow font-bold uppercase text-xs transition cursor-pointer flex items-center justify-center gap-2 rounded-none"
        >
          <BellRing className="w-4 h-4 shrink-0" />
          <span>Fire Immediate Checkpoint Prompt</span>
        </button>
      </div>

    </div>
  );
}
