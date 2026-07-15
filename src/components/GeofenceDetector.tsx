"use client";

import React, { useState, useEffect } from "react";
import { Navigation, ShieldCheck, MapPin, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { dbGetSites, dbAddEvent, dbAddAuditLog, Site, ShiftEvent, dbGetShifts, dbUpdateShift } from "@/lib/db";

interface GeofenceDetectorProps {
  uid: string;
  onValidationSuccess: (event: ShiftEvent) => void;
  activePrompt: boolean;
  setActivePrompt: (val: boolean) => void;
  selectedStaffId?: string; // Links geofencing validations to scheduling roster
  selectedStaffName?: string;
}

// Haversine formula to compute distance in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function GeofenceDetector({ uid, onValidationSuccess, activePrompt, setActivePrompt, selectedStaffId, selectedStaffName }: GeofenceDetectorProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestSite, setNearestSite] = useState<{ site: Site; distance: number } | null>(null);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    siteName: string;
    distance: number;
    radius: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Simulator State
  const [simulatedCoords, setSimulatedCoords] = useState<{ name: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    async function loadSites() {
      const data = await dbGetSites(uid);
      setSites(data);
    }
    loadSites();
  }, [uid]);

  // Dynamically constructed GPS simulation options based on active database sites + actual GPS
  const mockLocations = [
    { name: "Actual GPS", lat: 0, lng: 0 },
    ...sites.map(site => ({
      name: `${site.name} (On-Site Sim)`,
      lat: site.lat,
      lng: site.lng
    })),
    // Fallbacks if no sites are registered yet
    ...(sites.length === 0 ? [
      { name: "Dartmouth Castle (On-Site #1)", lat: 50.34285, lng: -3.56585 },
      { name: "Town Jetty / Harbour (On-Site #2)", lat: 50.35102, lng: -3.57852 },
      { name: "Royal Naval College (On-Site #3)", lat: 50.35624, lng: -3.58284 },
    ] : []),
    { name: "Off-Site (Totnes Road Sim)", lat: 50.36110, lng: -3.61500 },
  ];

  const handleValidate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setValidationResult(null);
    setNearestSite(null);

    // Load latest sites dynamically
    let latestSites = sites;
    try {
      latestSites = await dbGetSites(uid);
      setSites(latestSites);
    } catch (err) {
      console.warn("Failed to fetch latest sites for geofencing:", err);
    }

    // 1. Get Coordinates (Simulated or Real GPS)
    let currentLat = 0;
    let currentLng = 0;

    if (simulatedCoords && simulatedCoords.name !== "Actual GPS") {
      currentLat = simulatedCoords.lat;
      currentLng = simulatedCoords.lng;
      setCoords({ lat: currentLat, lng: currentLng });
      await dbAddAuditLog(uid, "LOCATION_SIMULATION_ACTIVE", `Using mock GPS coordinate profile: ${simulatedCoords.name}`);
      evaluateGeofence(currentLat, currentLng, latestSites);
    } else {
      if (typeof window === "undefined" || !navigator.geolocation) {
        setErrorMsg("HTML5 Geolocation is not supported by this browser.");
        setLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          currentLat = position.coords.latitude;
          currentLng = position.coords.longitude;
          setCoords({ lat: currentLat, lng: currentLng });
          await dbAddAuditLog(uid, "LOCATION_GPS_ACQUIRED", `Successfully fetched HTML5 GPS coordinates: (${currentLat.toFixed(5)}, ${currentLng.toFixed(5)})`);
          evaluateGeofence(currentLat, currentLng, latestSites);
        },
        async (error) => {
          console.error(error);
          let errText = "Unable to retrieve your location.";
          if (error.code === error.PERMISSION_DENIED) {
            errText = "Location permission denied. Please allow location access or use the GPS simulator options below.";
          }
          setErrorMsg(errText);
          await dbAddAuditLog(uid, "LOCATION_GPS_FAILED", `Failed to get HTML5 coordinates: Code ${error.code} - ${error.message}`);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const evaluateGeofence = async (lat: number, lng: number, latestSitesList?: Site[]) => {
    const activeSites = latestSitesList || sites;
    if (activeSites.length === 0) {
      setErrorMsg("No active sites loaded to validate against.");
      setLoading(false);
      return;
    }

    let minDistance = Infinity;
    let closestSite: Site | null = null;
    let matchedSite: Site | null = null;

    // Find closest and matched site using synchronous loop
    for (const site of activeSites) {
      const distance = getDistance(lat, lng, site.lat, site.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestSite = site;
      }
      if (distance <= site.radius) {
        matchedSite = site;
      }
    }

    if (closestSite) {
      setNearestSite({ site: closestSite, distance: minDistance });
    }

    if (matchedSite) {
      // ON-SITE SUCCESS
      const res = {
        success: true,
        siteName: matchedSite.name,
        distance: minDistance,
        radius: matchedSite.radius,
      };
      setValidationResult(res);

      // Save event to Firestore/Local database
      const eventData = {
        type: "check_in" as const,
        timestamp: new Date().toISOString(),
        locationName: matchedSite.name,
        lat,
        lng,
        staffId: selectedStaffId,
        staffName: selectedStaffName,
      };

      const eventId = await dbAddEvent(uid, eventData);
      const fullEvent: ShiftEvent = { id: eventId, ...eventData };

      // Link check-in validation to staff shift if selectedStaffId is present
      if (selectedStaffId) {
        const shifts = await dbGetShifts(uid);
        const todayStr = new Date().toISOString().split("T")[0];
        
        let matchedShift = null;
        if (
          matchedSite?.type === "global" || 
          matchedSite?.type === "merchant" || 
          (matchedSite?.type === "admin" && !matchedSite.associatedSiteId)
        ) {
          matchedShift = shifts.find(
            s => s.staffId === selectedStaffId && 
            s.date === todayStr && 
            !s.validated
          );
        } else if (matchedSite?.type === "admin" && matchedSite.associatedSiteId) {
          const associatedSite = activeSites.find(s => s.id === matchedSite.associatedSiteId);
          matchedShift = shifts.find(
            s => s.staffId === selectedStaffId && 
            s.date === todayStr && 
            s.siteName === associatedSite?.name &&
            !s.validated
          );
        } else {
          matchedShift = shifts.find(
            s => s.staffId === selectedStaffId && 
            s.date === todayStr && 
            s.siteName === matchedSite?.name &&
            !s.validated
          );
          if (!matchedShift) {
            matchedShift = shifts.find(
              s => s.staffId === selectedStaffId && 
              s.date === todayStr && 
              !s.validated
            );
          }
        }

        if (matchedShift) {
          await dbUpdateShift(uid, matchedShift.id, {
            validated: true,
            validatedAt: new Date().toISOString()
          });
          
          let logAction = "SHIFT_VALIDATED_AUTOMATICALLY";
          let logDetails = `Shift ID ${matchedShift.id} for worker ${matchedShift.staffName} validated at site ${matchedSite.name} via geofencing.`;
          
          if (matchedSite?.type === "global") {
            logAction = "SHIFT_VALIDATED_VIA_GLOBAL_LOCATION";
            logDetails = `Shift ID ${matchedShift.id} for worker ${matchedShift.staffName} validated via Global Location (${matchedSite.name}).`;
          } else if (matchedSite?.type === "merchant") {
            logAction = "SHIFT_VALIDATED_VIA_MERCHANT";
            logDetails = `Shift ID ${matchedShift.id} for worker ${matchedShift.staffName} validated via Merchant Location (${matchedSite.name}).`;
          } else if (matchedSite?.type === "admin") {
            logAction = "SHIFT_VALIDATED_VIA_ADMIN_AREA";
            logDetails = `Shift ID ${matchedShift.id} for worker ${matchedShift.staffName} validated via Admin Area (${matchedSite.name}).`;
          }
          
          await dbAddAuditLog(uid, logAction, logDetails);
        } else {
          let logAction = "LOCATION_CHECK_IN_SUCCESS";
          let logDetails = `Check-in recorded at ${matchedSite.name} (distance: ${minDistance.toFixed(1)}m from center).`;
          
          if (matchedSite?.type === "global") {
            logAction = "GLOBAL_LOCATION_CHECK_IN";
            logDetails = `Worker ${selectedStaffName || "unknown"} checked in at Global Location (${matchedSite.name}).`;
          } else if (matchedSite?.type === "merchant") {
            logAction = "MERCHANT_CHECK_IN";
            logDetails = `Worker ${selectedStaffName || "unknown"} checked in at Merchant Location (${matchedSite.name}).`;
          }
          
          await dbAddAuditLog(uid, logAction, logDetails);
        }
      } else {
        let logAction = "SHIFT_CHECK_IN_SUCCESS";
        let logDetails = `General check-in successful. Located at ${matchedSite.name} (distance: ${minDistance.toFixed(1)}m from center).`;
        
        if (matchedSite?.type === "global") {
          logAction = "GLOBAL_LOCATION_CHECK_IN_GENERAL";
          logDetails = `General check-in at Global Location (${matchedSite.name}).`;
        } else if (matchedSite?.type === "merchant") {
          logAction = "MERCHANT_CHECK_IN_GENERAL";
          logDetails = `General check-in at Merchant Location (${matchedSite.name}).`;
        }
        
        await dbAddAuditLog(uid, logAction, logDetails);
      }

      onValidationSuccess(fullEvent);
      setActivePrompt(false);
    } else {
      // OFF-SITE FAIL
      const closestName = closestSite ? (closestSite as Site).name : "Unknown Site";
      const res = {
        success: false,
        siteName: closestName,
        distance: minDistance,
        radius: closestSite ? (closestSite as Site).radius : 0,
      };
      setValidationResult(res);

      await dbAddAuditLog(
        uid,
        "SHIFT_CHECK_IN_BLOCKED",
        `Shift check-in blocked. Off-site. Distance to closest site (${closestName}) is ${minDistance.toFixed(1)}m (required <= ${(closestSite as any)?.radius}m).`
      );
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 font-mono text-sm space-y-5">
      
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
        <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Navigation className="text-brand-blue w-5 h-5" />
          <span>Active Geofence Validator</span>
        </h3>
        <span className="text-xs text-slate-500 uppercase font-bold tracking-wide">Client Verification</span>
      </div>

      {/* Main Validation Action */}
      <div className="space-y-3">
        <button
          onClick={handleValidate}
          disabled={loading}
          className="w-full h-12 bg-brand-blue hover:bg-blue-600 text-slate-950 font-extrabold uppercase tracking-wider text-center cursor-pointer transition flex items-center justify-center gap-2.5 rounded-none disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base shadow-md"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>ACQUIRING GPS LOCK...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Validate My Shift Location</span>
            </>
          )}
        </button>
      </div>

      {/* GPS Location Status Indicator */}
      {coords && (
        <div className="bg-slate-950 p-3 border border-slate-850 rounded-none flex flex-col gap-1.5 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>LOCK STATUS</span>
            <span className="text-emerald-400 font-bold">SECURE GPS FIXED</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-300">
            <span>COORDINATES</span>
            <span>({coords.lat.toFixed(6)}, {coords.lng.toFixed(6)})</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/70 border border-rose-900 text-rose-350 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Validation Results Widget */}
      {validationResult && (
        <div className={`p-5 border rounded-none space-y-2.5 ${
          validationResult.success 
            ? "bg-emerald-950/70 border-emerald-800 text-emerald-300"
            : "bg-rose-950/70 border-rose-900 text-rose-300"
        }`}>
          <div className="flex items-center gap-2.5 font-bold text-sm uppercase">
            <MapPin className="w-5 h-5" />
            <span>{validationResult.success ? "VALIDATION PASSED" : "VALIDATION BLOCKED"}</span>
          </div>

          <p className="text-sm leading-relaxed font-semibold">
            {validationResult.success ? (
              <>
                Confirming check-in at <strong className="text-slate-100">{validationResult.siteName}</strong>. 
                Your device position is {validationResult.distance.toFixed(1)}m from center (geofence boundary: {validationResult.radius}m).
              </>
            ) : (
              <>
                You are currently classified as <strong className="text-slate-100">OFF-SITE</strong>. 
                Nearest geofenced location is <strong className="text-slate-100">{validationResult.siteName}</strong> ({validationResult.distance.toFixed(1)}m distance; boundary limit: {validationResult.radius}m).
              </>
            )}
          </p>
        </div>
      )}

      {/* GPS COORDINATE TESTING SIMULATOR PANEL */}
      <div className="bg-slate-950 border border-slate-850 p-4 space-y-3">
        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>GPS Simulator (Scalebanana Testing Panel)</span>
          <button type="button" onClick={() => setSimulatedCoords(null)} title="Reset simulator" className="text-slate-500 hover:text-slate-350 cursor-pointer flex items-center justify-center">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {mockLocations.map((loc) => (
            <button
              key={loc.name}
              type="button"
              onClick={() => setSimulatedCoords(loc.name === "Actual GPS" ? null : loc)}
              className={`p-2.5 border text-left cursor-pointer transition rounded-none font-bold ${
                (simulatedCoords === null && loc.name === "Actual GPS") || 
                (simulatedCoords?.name === loc.name)
                  ? "bg-brand-blue/20 text-brand-blue border-brand-blue/50"
                  : "bg-slate-900 hover:bg-slate-850 text-slate-400 border-slate-800"
              }`}
            >
              <div className="truncate">{loc.name}</div>
              {loc.lat !== 0 && <div className="text-[10px] text-slate-650 mt-0.5">({loc.lat}, {loc.lng})</div>}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 leading-normal">
          * Use simulated locations to test geofencing inside the Dartmouth geofences while testing in any UK location.
        </div>
      </div>

    </div>
  );
}
