"use client";

import React, { useState, useEffect, useRef } from "react";
import { LogOut, Clock, Check, HelpCircle } from "lucide-react";
import { dbAddEvent, dbAddAuditLog, validateWhat3Words, ShiftEvent } from "@/lib/db";

interface OffSiteModuleProps {
  uid: string;
  onOffSiteSuccess: (event: ShiftEvent) => void;
  selectedStaffId?: string;
  selectedStaffName?: string;
}

// Predefined mock what3words list for local autosuggestion (Dartmouth/South Hams area)
const MOCK_W3W_SUGGESTIONS = [
  { w3w: "///filled.count.soap", location: "Dartmouth Castle Lookout" },
  { w3w: "///index.home.raft", location: "Dartmouth Town Jetty / Pontoon" },
  { w3w: "///wobble.fuzzy.piles", location: "Royal Naval College Parade Ground" },
  { w3w: "///daring.lion.metals", location: "Dart Marina Yacht Club" },
  { w3w: "///grows.hothouse.dined", location: "Cherubs Nest Historic Cottage" },
  { w3w: "///decoding.relate.grins", location: "Dartmouth Castle Tea Rooms" },
  { w3w: "///mural.overnight.mending", location: "South Sands Beach Parking" },
  { w3w: "///vocal.cushioned.gracing", location: "Dartmouth Museum Entryway" }
];

export function OffSiteModule({ uid, onOffSiteSuccess, selectedStaffId, selectedStaffName }: OffSiteModuleProps) {
  const [w3wInput, setW3wInput] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [suggestions, setSuggestions] = useState<{ w3w: string; location: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle typing suggestions
  useEffect(() => {
    if (w3wInput.length < 2) {
      setSuggestions([]);
      return;
    }

    const query = w3wInput.toLowerCase();
    const filtered = MOCK_W3W_SUGGESTIONS.filter(
      (item) => 
        item.w3w.toLowerCase().includes(query) || 
        item.location.toLowerCase().includes(query)
    );
    setSuggestions(filtered);
  }, [w3wInput]);

  // Close suggestions dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (w3w: string) => {
    setW3wInput(w3w);
    setSuggestions([]);
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMsg(null);
    setLoading(true);

    let cleanW3W = w3wInput.trim();
    if (cleanW3W && !cleanW3W.startsWith("///")) {
      cleanW3W = "///" + cleanW3W;
    }

    // Validate what3words pattern
    if (!validateWhat3Words(cleanW3W)) {
      setValidationError("Invalid what3words address. Format must be ///word.word.word");
      setLoading(false);
      return;
    }

    if (!returnTime) {
      setValidationError("Please select or enter an expected return time.");
      setLoading(false);
      return;
    }

    try {
      let lat = 50.3510; 
      let lng = -3.5785;

      if (typeof window !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            saveDeparture(cleanW3W, returnTime, lat, lng);
          },
          () => {
            saveDeparture(cleanW3W, returnTime, lat, lng);
          },
          { timeout: 3000 }
        );
      } else {
        saveDeparture(cleanW3W, returnTime, lat, lng);
      }
    } catch (err) {
      console.error(err);
      setValidationError("Failed to record transit. Please try again.");
      setLoading(false);
    }
  };

  const saveDeparture = async (w3w: string, time: string, lat: number, lng: number) => {
    const matchedSuggestion = MOCK_W3W_SUGGESTIONS.find(s => s.w3w === w3w);
    const locationDescription = matchedSuggestion 
      ? `Transit to ${matchedSuggestion.location} (${w3w})` 
      : `Transit to ${w3w}`;

    const eventData = {
      type: "depart" as const,
      timestamp: new Date().toISOString(),
      locationName: locationDescription,
      lat,
      lng,
      what3words: w3w,
      expectedReturn: time,
      staffId: selectedStaffId,
      staffName: selectedStaffName
    };

    const eventId = await dbAddEvent(uid, eventData);
    const fullEvent: ShiftEvent = { id: eventId, ...eventData };

    await dbAddAuditLog(
      uid, 
      "SHIFT_OFFSITE_DEPARTURE", 
      `Worker registered driving off-site to ${w3w} (${matchedSuggestion?.location || 'custom'}). Expected return: ${time}.`
    );

    onOffSiteSuccess(fullEvent);
    setW3wInput("");
    setReturnTime("");
    setSuccessMsg(`Departure logged! Transit to destination (${w3w}) is active. Expected return at ${time}.`);
    setLoading(false);
    
    setTimeout(() => setSuccessMsg(null), 6000);
  };

  const setQuickTime = (mins: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + mins);
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setReturnTime(`${hh}:${mm}`);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 font-mono text-sm space-y-5">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <LogOut className="text-brand-yellow w-5 h-5" />
          <span>Transit Departure Logger</span>
        </h3>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-wide">what3words Transit</span>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-300 flex items-start gap-3 rounded-none">
          <Check className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="font-semibold">{successMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 relative">
        
        {/* Destination what3words input */}
        <div className="space-y-1.5 relative" ref={dropdownRef}>
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            Destination what3words
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-brand-yellow font-extrabold text-sm">///</span>
            <input
              type="text"
              value={w3wInput.replace(/^\/{3}/, "")} 
              onChange={(e) => setW3wInput(e.target.value)}
              placeholder="word.word.word"
              className="w-full h-10 pl-10 pr-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold rounded-none text-sm"
              disabled={loading}
              required
            />
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 z-50 mt-1 bg-slate-950 border border-slate-800 max-h-48 overflow-y-auto rounded-none shadow-xl divide-y divide-slate-900">
              {suggestions.map((item) => (
                <button
                  key={item.w3w}
                  type="button"
                  onClick={() => handleSelectSuggestion(item.w3w)}
                  className="w-full p-2.5 text-left hover:bg-slate-900 text-xs flex justify-between items-center cursor-pointer transition text-slate-300 font-medium"
                >
                  <span className="font-bold text-brand-yellow">{item.w3w}</span>
                  <span className="text-slate-500 font-semibold truncate ml-2 max-w-[220px]">{item.location}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expected return time */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
            Expected Return Time
          </label>
          <div className="flex gap-2">
            <input
              type="time"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              className="h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold rounded-none grow text-center text-sm"
              disabled={loading}
              required
            />
          </div>
          
          {/* Quick presets */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setQuickTime(30)}
              className="px-2 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-slate-250 cursor-pointer text-xs rounded-none grow font-bold"
            >
              +30m
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(60)}
              className="px-2 py-1.5 bg-slate-950 hover:bg-slate-855 border border-slate-855 text-slate-400 hover:text-slate-250 cursor-pointer text-xs rounded-none grow font-bold"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(120)}
              className="px-2 py-1.5 bg-slate-950 hover:bg-slate-855 border border-slate-855 text-slate-400 hover:text-slate-250 cursor-pointer text-xs rounded-none grow font-bold"
            >
              +2h
            </button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationError && (
          <div className="text-xs text-brand-red font-bold animate-pulse">{validationError}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 font-extrabold uppercase tracking-wider text-center cursor-pointer transition flex items-center justify-center gap-2 rounded-none disabled:opacity-50 text-sm"
        >
          <Clock className="w-4 h-4" />
          <span>Record Transit Departure</span>
        </button>

      </form>
      
      <div className="text-xs text-slate-500 leading-normal flex items-start gap-2 pt-1 border-t border-slate-850">
        <HelpCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
        <span>Use three-word codes to report targets (e.g. ///filled.count.soap for Dartmouth Castle).</span>
      </div>

    </div>
  );
}
