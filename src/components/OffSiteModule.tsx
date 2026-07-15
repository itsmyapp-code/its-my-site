"use client";

import React, { useState, useEffect, useRef } from "react";
import { LogOut, Clock, Check, HelpCircle } from "lucide-react";
import { dbAddEvent, dbAddAuditLog, validateWhat3Words, ShiftEvent, resolvePostcode, resolveWhat3WordsMock, dbGetSites, dbGetShifts, Site } from "@/lib/db";

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
  const [inputMethod, setInputMethod] = useState<"w3w" | "postcode" | "coords">("w3w");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [suggestions, setSuggestions] = useState<{ w3w: string; location: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [todaySite, setTodaySite] = useState<Site | null>(null);

  useEffect(() => {
    async function loadSitesAndActive() {
      try {
        const loadedSites = await dbGetSites(uid);
        setSites(loadedSites);

        if (selectedStaffId) {
          const shifts = await dbGetShifts(uid);
          const todayStr = new Date().toISOString().split("T")[0];
          const workerTodayShifts = shifts.filter(s => s.staffId === selectedStaffId && s.date === todayStr);
          if (workerTodayShifts.length > 0) {
            const activeShift = workerTodayShifts[0];
            const matchedSite = loadedSites.find(s => s.id === activeShift.siteId);
            if (matchedSite) {
              setTodaySite(matchedSite);
            } else {
              setTodaySite(null);
            }
          } else {
            setTodaySite(null);
          }
        } else {
          setTodaySite(null);
        }
      } catch (err) {
        console.error("Error loading active site for logger:", err);
      }
    }
    loadSitesAndActive();
  }, [uid, selectedStaffId]);

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

    if (!returnTime) {
      setValidationError("Please select or enter an expected return time.");
      setLoading(false);
      return;
    }

    try {
      let lat = 50.3510;
      let lng = -3.5785;
      let cleanW3W = undefined;
      let postcodeVal = undefined;
      let locationDescription = "";

      if (inputMethod === "w3w") {
        let w3wClean = w3wInput.trim();
        if (w3wClean && !w3wClean.startsWith("///")) {
          w3wClean = "///" + w3wClean;
        }
        if (!validateWhat3Words(w3wClean)) {
          setValidationError("Invalid what3words address. Format must be ///word.word.word");
          setLoading(false);
          return;
        }
        cleanW3W = w3wClean;
        const coords = resolveWhat3WordsMock(w3wClean);
        lat = coords.lat;
        lng = coords.lng;
        const matchedSuggestion = MOCK_W3W_SUGGESTIONS.find(s => s.w3w === w3wClean);
        locationDescription = matchedSuggestion
          ? `Transit to ${matchedSuggestion.location} (${w3wClean})`
          : `Transit to ${w3wClean}`;
      } else if (inputMethod === "postcode") {
        const pcClean = postcodeInput.trim().toUpperCase();
        if (!pcClean) {
          setValidationError("Please enter a postcode.");
          setLoading(false);
          return;
        }
        setValidationError("Resolving postcode...");
        const coords = await resolvePostcode(pcClean);
        if (!coords) {
          setValidationError("Could not resolve postcode. Check format.");
          setLoading(false);
          return;
        }
        setValidationError(null);
        lat = coords.lat;
        lng = coords.lng;
        postcodeVal = pcClean;
        locationDescription = `Transit to Postcode ${pcClean}`;
      } else {
        const latNum = parseFloat(latInput);
        const lngNum = parseFloat(lngInput);
        if (isNaN(latNum) || isNaN(lngNum)) {
          setValidationError("Coordinates must be valid numbers.");
          setLoading(false);
          return;
        }
        lat = latNum;
        lng = lngNum;
        locationDescription = `Transit to Coordinates (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      }

      await saveDeparture(cleanW3W, postcodeVal, returnTime, lat, lng, locationDescription);
    } catch (err) {
      console.error(err);
      setValidationError("Failed to record transit. Please try again.");
      setLoading(false);
    }
  };

  const saveDeparture = async (
    w3w: string | undefined, 
    postcode: string | undefined, 
    time: string, 
    lat: number, 
    lng: number, 
    locationDescription: string
  ) => {
    const eventData = {
      type: "depart" as const,
      timestamp: new Date().toISOString(),
      locationName: locationDescription,
      lat,
      lng,
      what3words: w3w,
      postcode: postcode,
      expectedReturn: time,
      staffId: selectedStaffId,
      staffName: selectedStaffName
    };

    const eventId = await dbAddEvent(uid, eventData);
    const fullEvent: ShiftEvent = { id: eventId, ...eventData };

    await dbAddAuditLog(
      uid, 
      "SHIFT_OFFSITE_DEPARTURE", 
      `Worker registered driving off-site to ${locationDescription}. Expected return: ${time}.`
    );

    onOffSiteSuccess(fullEvent);
    setW3wInput("");
    setPostcodeInput("");
    setLatInput("");
    setLngInput("");
    setReturnTime("");
    setSuccessMsg(`Departure logged! ${locationDescription} is active. Expected return at ${time}.`);
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
        
        <div>
          <label className="text-xs text-slate-450 font-bold uppercase tracking-wider block mb-1">Destination Address Type</label>
          <div className="flex gap-2">
            {["w3w", "postcode", "coords"].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setInputMethod(method as any)}
                className={`flex-1 h-8 text-[11px] font-bold uppercase tracking-wider border rounded-none transition cursor-pointer ${
                  inputMethod === method
                    ? "bg-brand-yellow border-brand-yellow text-slate-955"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {method === "w3w" ? "what3words" : method === "postcode" ? "Postcode" : "Lat/Lng"}
              </button>
            ))}
          </div>
        </div>

        {/* Suggested Destinations based on todaySite */}
        {todaySite && todaySite.transitDestinations && todaySite.transitDestinations.length > 0 && (
          <div className="bg-slate-950 border border-slate-850 p-3 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Suggested Transit Destinations:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {todaySite.transitDestinations.map((dest) => (
                <button
                  key={dest.name}
                  type="button"
                  onClick={() => {
                    const addr = dest.address.trim();
                    if (addr.startsWith("///")) {
                      setInputMethod("w3w");
                      setW3wInput(addr);
                    } else if (/^[a-zA-Z]{1,2}\d[a-zA-Z\d]?\s*\d[a-zA-Z]{2}$/.test(addr.replace(/\s+/g, "")) || addr.length <= 8) {
                      setInputMethod("postcode");
                      setPostcodeInput(addr);
                    } else {
                      setInputMethod("coords");
                      const parts = addr.split(",");
                      if (parts.length === 2) {
                        setLatInput(parts[0].trim());
                        setLngInput(parts[1].trim());
                      }
                    }
                  }}
                  className="p-2 border border-slate-800 bg-slate-900 hover:bg-slate-850 text-left text-xs font-semibold text-slate-350 hover:text-slate-100 transition rounded-none flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate">{dest.name}</span>
                  <span className="text-[10px] text-brand-blue font-bold font-mono">{dest.address}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conditional inputs */}
        {inputMethod === "w3w" && (
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
        )}

        {inputMethod === "postcode" && (
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
              Destination UK Postcode
            </label>
            <input
              type="text"
              placeholder="e.g. TQ6 9JN"
              value={postcodeInput}
              onChange={(e) => setPostcodeInput(e.target.value)}
              className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold rounded-none text-sm"
              disabled={loading}
              required
            />
          </div>
        )}

        {inputMethod === "coords" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Latitude</label>
              <input
                type="text"
                placeholder="50.3428"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold rounded-none text-sm"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Longitude</label>
              <input
                type="text"
                placeholder="-3.5658"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                className="w-full h-10 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue font-bold rounded-none text-sm"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}

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
              className="px-2 py-1.5 bg-slate-955 hover:bg-slate-855 border border-slate-855 text-slate-400 hover:text-slate-250 cursor-pointer text-xs rounded-none grow font-bold"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => setQuickTime(120)}
              className="px-2 py-1.5 bg-slate-955 hover:bg-slate-855 border border-slate-855 text-slate-400 hover:text-slate-250 cursor-pointer text-xs rounded-none grow font-bold"
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
          className="w-full h-11 bg-slate-955 hover:bg-slate-900 border border-slate-800 text-slate-200 font-extrabold uppercase tracking-wider text-center cursor-pointer transition flex items-center justify-center gap-2 rounded-none disabled:opacity-50 text-sm"
        >
          <Clock className="w-4 h-4" />
          <span>Record Transit Departure</span>
        </button>

      </form>
      
      <div className="text-xs text-slate-500 leading-normal flex items-start gap-2 pt-1 border-t border-slate-850">
        <HelpCircle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
        <span>Select your method and enter target details (e.g. what3words, UK postcode, or GPS coordinates).</span>
      </div>

    </div>
  );
}
