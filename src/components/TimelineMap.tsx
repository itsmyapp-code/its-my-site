"use client";

import React, { useEffect, useRef, useState } from "react";
import { Map, Plus, Trash2, MapPin, ListOrdered, Calendar, Bell, X, Check } from "lucide-react";
import { 
  dbGetSites, 
  dbAddSite, 
  dbDeleteSite, 
  dbGetEvents, 
  dbAddAuditLog, 
  dbUpdateSite,
  dbGetStaff,
  dbAddValidationRequest,
  Site, 
  ShiftEvent, 
  Staff,
  resolvePostcode, 
  resolveWhat3WordsMock,
  resolveWhat3Words
} from "@/lib/db";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

function getSiteColor(type?: string, siteName: string = ""): { bg: string; text: string; hex: string } {
  if (type === "global") {
    return { bg: "bg-purple-600", text: "text-purple-400", hex: "#a855f7" };
  }
  if (type === "merchant") {
    return { bg: "bg-amber-500", text: "text-amber-400", hex: "#f59e0b" };
  }
  if (type === "geofence") {
    return { bg: "bg-blue-600", text: "text-blue-400", hex: "#3b82f6" };
  }

  const name = siteName.toLowerCase();
  
  if (name.includes("castle")) {
    return { bg: "bg-indigo-600", text: "text-indigo-400", hex: "#4f46e5" };
  }
  if (name.includes("jetty") || name.includes("harbour") || name.includes("pontoon") || name.includes("port")) {
    return { bg: "bg-cyan-500", text: "text-cyan-400", hex: "#06b6d4" };
  }
  if (name.includes("college") || name.includes("royal") || name.includes("naval")) {
    return { bg: "bg-fuchsia-600", text: "text-fuchsia-400", hex: "#c084fc" };
  }
  if (name.includes("marina") || name.includes("yacht") || name.includes("boat")) {
    return { bg: "bg-teal-500", text: "text-teal-400", hex: "#14b8a6" };
  }
  if (name.includes("norton")) {
    return { bg: "bg-amber-550", text: "text-amber-450", hex: "#d97706" };
  }
  
  const colors = [
    { bg: "bg-blue-600", text: "text-blue-400", hex: "#2563eb" },
    { bg: "bg-emerald-600", text: "text-emerald-400", hex: "#059669" },
    { bg: "bg-violet-600", text: "text-violet-400", hex: "#7c3aed" },
    { bg: "bg-rose-600", text: "text-rose-400", hex: "#e11d48" },
    { bg: "bg-amber-600", text: "text-amber-400", hex: "#d97706" },
  ];
  let hash = 0;
  for (let i = 0; i < siteName.length; i++) {
    hash = siteName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

interface TimelineMapProps {
  uid: string;
  refreshTrigger: number; // Increment to trigger map/list refresh
}

export function TimelineMap({ uid, refreshTrigger }: TimelineMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const layersGroupRef = useRef<any | null>(null);
  const draftMarkerRef = useRef<any | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [events, setEvents] = useState<ShiftEvent[]>([]);
  
  // Site creator form state
  const [siteName, setSiteName] = useState("");
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  const [siteRadius, setSiteRadius] = useState("100");
  const [siteType, setSiteType] = useState<"geofence" | "merchant" | "global" | "admin">("geofence");
  const [formMsg, setFormMsg] = useState("");
  
  const [inputMethod, setInputMethod] = useState<"coords" | "w3w" | "postcode">("coords");
  const [w3wInput, setW3wInput] = useState("");
  const [postcodeInput, setPostcodeInput] = useState("");
  const [associatedSiteId, setAssociatedSiteId] = useState("");
  const [newTimeInputs, setNewTimeInputs] = useState<Record<string, string>>({});

  // validationTimes array state and newTimeInput state (replaces validationTimesStr)
  const [validationTimes, setValidationTimes] = useState<string[]>([]);
  const [newTimeInput, setNewTimeInput] = useState("");

  // Instant check-in state
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [instantTargetType, setInstantTargetType] = useState<"site" | "staff">("site");
  const [instantTargetIds, setInstantTargetIds] = useState<string[]>([]);
  const [dispatchMsg, setDispatchMsg] = useState("");
  
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleRemoveValidationTime = async (siteId: string, timeToRemove: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const updatedTimes = (site.validationTimes || []).filter(t => t !== timeToRemove);
    try {
      await dbUpdateSite(uid, siteId, { validationTimes: updatedTimes });
      await dbAddAuditLog(uid, "VALIDATION_SCHEDULE_UPDATED", `Removed checkpoint ${timeToRemove} from site ${site.name}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddValidationTimeDirect = async (siteId: string) => {
    const newTime = newTimeInputs[siteId]?.trim();
    if (!newTime || !/^\d{2}:\d{2}$/.test(newTime)) return;
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const currentTimes = site.validationTimes || [];
    if (currentTimes.includes(newTime)) return;
    const updatedTimes = [...currentTimes, newTime].sort();
    try {
      await dbUpdateSite(uid, siteId, { validationTimes: updatedTimes });
      await dbAddAuditLog(uid, "VALIDATION_SCHEDULE_UPDATED", `Added checkpoint ${newTime} to site ${site.name}`);
      setNewTimeInputs(prev => ({ ...prev, [siteId]: "" }));
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTransitDestination = async (siteId: string, name: string, address: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const currentDests = site.transitDestinations || [];
    if (currentDests.some(d => d.name.toLowerCase() === name.toLowerCase())) return;
    
    const updatedDests = [...currentDests, { name, address }];
    try {
      await dbUpdateSite(uid, siteId, { transitDestinations: updatedDests });
      await dbAddAuditLog(uid, "TRANSIT_DESTINATIONS_UPDATED", `Added transit destination ${name} (${address}) to site ${site.name}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTransitDestination = async (siteId: string, nameToRemove: string) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return;
    const updatedDests = (site.transitDestinations || []).filter(d => d.name !== nameToRemove);
    try {
      await dbUpdateSite(uid, siteId, { transitDestinations: updatedDests });
      await dbAddAuditLog(uid, "TRANSIT_DESTINATIONS_UPDATED", `Removed transit destination ${nameToRemove} from site ${site.name}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Load sites and events from DB
  const loadData = async () => {
    try {
      const loadedSites = await dbGetSites(uid);
      const loadedEvents = await dbGetEvents(uid);
      const loadedStaff = await dbGetStaff(uid);
      setSites(loadedSites);
      setEvents(loadedEvents);
      setStaffList(loadedStaff);
    } catch (err) {
      console.error("Error loading map data:", err);
    }
  };

  const handleDispatchInstantValidation = async () => {
    if (instantTargetIds.length === 0) return;
    setDispatchMsg("Dispatching request...");
    try {
      await dbAddValidationRequest(uid, instantTargetType, instantTargetIds);
      
      const targetNames = instantTargetType === "site" 
        ? sites.filter(s => instantTargetIds.includes(s.id)).map(s => s.name).join(", ")
        : staffList.filter(s => instantTargetIds.includes(s.id)).map(s => s.name).join(", ");

      await dbAddAuditLog(
        uid,
        "VALIDATION_REQUEST_DISPATCHED",
        `Admin dispatched instant validation request to targeted ${instantTargetType}s: ${targetNames}`
      );

      setDispatchMsg("Request dispatched successfully!");
      setInstantTargetIds([]);
      setTimeout(() => setDispatchMsg(""), 3000);
    } catch (err) {
      console.error(err);
      setDispatchMsg("Error dispatching validation request.");
    }
  };

  useEffect(() => {
    loadData();
  }, [uid, refreshTrigger]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || !L) return;

    // Create map instance centered on default Dartmouth harbor coordinates
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    }).setView([50.3510, -3.5785], 13);

    mapInstanceRef.current = map;

    // Add CartoDB Positron TileLayer (light grey monochrome, meets 'vector style, no high-data satellite' constraint)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CartoDB</a> contributors',
    }).addTo(map);

    // Initialize layer group to manage dynamic pins/geofences
    const layersGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layersGroup;

    // Click event on map to auto-fill coordinates in Admin site form
    map.on("click", (e: any) => {
      const { lat, lng } = e.latlng;
      setSiteLat(lat.toFixed(6));
      setSiteLng(lng.toFixed(6));
      setFormMsg("Coordinates pinned from map tap.");
      setTimeout(() => setFormMsg(""), 3000);

      // Create or move draft marker (drop pin)
      if (draftMarkerRef.current) {
        draftMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const pinIcon = L.divIcon({
          className: "custom-draft-marker",
          html: `<div class="w-8 h-8 bg-brand-yellow border-2 border-slate-900 rounded-full flex items-center justify-center shadow-lg animate-bounce text-slate-900 font-extrabold text-sm">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });
        const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
        draftMarkerRef.current = marker;
      }
    });

    setMapLoaded(true);

    return () => {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove();
        draftMarkerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize draft pin when Lat/Lng changes manually (or via postcode/w3w resolution)
  useEffect(() => {
    if (!mapInstanceRef.current || !L) return;
    const lat = parseFloat(siteLat);
    const lng = parseFloat(siteLng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const pinIcon = L.divIcon({
          className: "custom-draft-marker",
          html: `<div class="w-8 h-8 bg-brand-yellow border-2 border-slate-900 rounded-full flex items-center justify-center shadow-lg animate-bounce text-slate-900 font-extrabold text-sm">📍</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });
        const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(mapInstanceRef.current);
        draftMarkerRef.current = marker;
      }
    } else {
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove();
        draftMarkerRef.current = null;
      }
    }
  }, [siteLat, siteLng]);

  // Update map overlays whenever sites or events change
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current || !L) return;

    // Clear previous layers
    layersGroupRef.current.clearLayers();

    // 1. Draw Admin Defined Geofence Sites (Bright Blue bounds, red center)
    sites.forEach((site) => {
      const colorInfo = getSiteColor(site.type, site.name);

      // Circle representing Geofence radius
      const circle = L.circle([site.lat, site.lng], {
        color: colorInfo.hex,
        fillColor: colorInfo.hex,
        fillOpacity: 0.12,
        radius: site.radius,
        weight: 2,
      });

      // Custom divicon for site center (coloured center)
      const siteIcon = L.divIcon({
        className: "custom-site-icon",
        html: `<div class="w-3.5 h-3.5 rounded-full border-2 border-slate-950 ${colorInfo.bg} shadow-md"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([site.lat, site.lng], { icon: siteIcon });
      marker.bindPopup(`
        <div class="font-mono text-sm">
          <strong class="${colorInfo.text} text-sm uppercase font-extrabold">${site.name}</strong><br/>
          Latitude: ${site.lat.toFixed(5)}<br/>
          Longitude: ${site.lng.toFixed(5)}<br/>
          Radius: ${site.radius}m
        </div>
      `);

      layersGroupRef.current.addLayer(circle);
      layersGroupRef.current.addLayer(marker);
    });

    // 2. Draw Check-ins / Transit Events chronologically
    events.forEach((evt, idx) => {
      let pinColor = "bg-brand-red"; // Default check-in is Bright Red
      let evtLabel = "CHECK-IN";

      const matchedSite = sites.find(s => evt.locationName.includes(s.name));
      if (matchedSite) {
        pinColor = getSiteColor(matchedSite.name).bg;
      } else if (evt.type === "depart") {
        pinColor = "bg-brand-yellow"; // Departure is Solar Yellow
        evtLabel = "DEPART TRANSIT";
      } else if (evt.type === "return") {
        pinColor = "bg-emerald-500";
        evtLabel = "RETURN ON-SITE";
      }

      // Custom divicon for Chronological pathing pins
      const customIcon = L.divIcon({
        className: "custom-path-icon",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-7 w-7 rounded-full ${pinColor} opacity-30 animate-ping"></span>
            <div class="w-6 h-6 rounded-full border border-slate-950 text-xs text-slate-950 font-bold flex items-center justify-center shadow-lg ${pinColor}">
              ${idx + 1}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([evt.lat, evt.lng], { icon: customIcon });
      marker.bindPopup(`
        <div class="font-mono text-sm">
          <div class="font-bold border-b border-slate-200 pb-1 mb-1 text-xs text-slate-500">${evtLabel} #${idx + 1}</div>
          <p class="font-semibold text-slate-800 text-sm">${evt.locationName}</p>
          <span class="text-xs text-slate-400">${new Date(evt.timestamp).toLocaleString("en-GB")}</span><br/>
          ${evt.staffName ? `<span class="text-xs text-slate-500 font-bold uppercase block mt-1">Staff: ${evt.staffName}</span>` : ""}
          ${evt.what3words ? `<strong class="text-brand-yellow font-semibold">w3w: ${evt.what3words}</strong><br/>` : ""}
          ${evt.expectedReturn ? `<span class="text-slate-550 font-bold">Return expected: ${evt.expectedReturn}</span>` : ""}
        </div>
      `);

      layersGroupRef.current.addLayer(marker);
    });

    // Auto fit bounds if sites exist to keep map focused
    if (sites.length > 0) {
      const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

  }, [sites, events]);

  // Form handlers
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName || !siteRadius) {
      setFormMsg("Please complete all inputs.");
      return;
    }

    let latNum = parseFloat(siteLat);
    let lngNum = parseFloat(siteLng);

    if (inputMethod === "w3w") {
      if (!w3wInput) {
        setFormMsg("Please enter a what3words address.");
        return;
      }
      setFormMsg("Resolving what3words...");
      const coords = await resolveWhat3Words(w3wInput);
      latNum = coords.lat;
      lngNum = coords.lng;
    } else if (inputMethod === "postcode") {
      if (!postcodeInput) {
        setFormMsg("Please enter a postcode.");
        return;
      }
      setFormMsg("Resolving postcode...");
      const coords = await resolvePostcode(postcodeInput);
      if (!coords) {
        setFormMsg("Could not resolve postcode. Check format.");
        return;
      }
      latNum = coords.lat;
      lngNum = coords.lng;
    }

    if (isNaN(latNum) || isNaN(lngNum) || isNaN(parseInt(siteRadius))) {
      setFormMsg("Latitude, longitude and radius must be valid.");
      return;
    }

    const radiusNum = parseInt(siteRadius);
    const timesArray = validationTimes;

    const siteData = {
      name: siteName,
      lat: latNum,
      lng: lngNum,
      radius: radiusNum,
      type: siteType,
      validationTimes: timesArray,
      associatedSiteId: siteType === "admin" && associatedSiteId ? associatedSiteId : undefined,
      what3words: inputMethod === "w3w" ? w3wInput : undefined,
      postcode: inputMethod === "postcode" ? postcodeInput : undefined,
    };

    setFormMsg("Saving site...");
    try {
      await dbAddSite(uid, siteData);
      setSiteName("");
      setSiteLat("");
      setSiteLng("");
      setSiteRadius("100");
      setSiteType("geofence");
      setW3wInput("");
      setPostcodeInput("");
      setAssociatedSiteId("");
      setValidationTimes([]);
      
      if (draftMarkerRef.current) {
        draftMarkerRef.current.remove();
        draftMarkerRef.current = null;
      }

      setFormMsg("Site registered successfully!");
      
      await dbAddAuditLog(
        uid, 
        "GEOFENCE_SITE_CREATED", 
        `Admin created new geofence site: ${siteData.name} at (${siteData.lat.toFixed(5)}, ${siteData.lng.toFixed(5)}) with radius ${siteData.radius}m.`
      );

      loadData();
    } catch (err) {
      console.error(err);
      setFormMsg("Error adding site.");
    }
  };

  const handleDeleteSite = async (id: string, name: string) => {
    if (confirm(`Remove geofence site "${name}"?`)) {
      await dbDeleteSite(uid, id);
      await dbAddAuditLog(
        uid, 
        "GEOFENCE_SITE_DELETED", 
        `Admin deleted geofence site: ${name} (ID: ${id})`
      );
      loadData();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono text-sm">
      
      {/* MAP CONTAINER (Col: 8) */}
      <div className="lg:col-span-8 flex flex-col space-y-3">
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5">
          <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Map className="w-5 h-5 text-brand-blue" />
            <span>Chronological Vector Tracking Map</span>
          </span>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">CartoDB Positron Engine</span>
        </div>
        
        {/* Leaflet hook */}
        <div className="border border-slate-800 bg-slate-950 h-[380px] lg:h-[480px] relative z-10">
          <div ref={containerRef} className="w-full h-full" />
          {!mapLoaded && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
              <span className="text-slate-400 font-bold animate-pulse text-sm">MOUNTING LEAFLET VECTOR CANVAS...</span>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-500 leading-normal">
          * Click/tap anywhere on the vector map above to automatically capture the coordinates into the Site Config form.
        </div>
      </div>

      {/* TIMELINE & CREATOR PANEL (Col: 4) */}
      <div className="lg:col-span-4 flex flex-col space-y-5">
        
        {/* Site Creator */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Plus className="w-5 h-5 text-brand-blue" />
            <span>Geofence Site Manager</span>
          </h3>

          <form onSubmit={handleAddSite} className="space-y-3">
            <div>
              <label className="text-xs text-slate-450 font-bold uppercase tracking-wider block mb-1">Site Name</label>
              <input
                type="text"
                placeholder="e.g. Dartmouth Castle"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-450 font-bold uppercase tracking-wider block mb-1">Address Input Method</label>
              <div className="flex gap-2">
                {["coords", "w3w", "postcode"].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setInputMethod(method as any)}
                    className={`flex-1 h-8 text-[11px] font-bold uppercase tracking-wider border rounded-none transition cursor-pointer ${
                      inputMethod === method
                        ? "bg-brand-blue border-brand-blue text-slate-955"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {method === "coords" ? "Lat/Lng" : method === "w3w" ? "what3words" : "Postcode"}
                  </button>
                ))}
              </div>
            </div>

            {inputMethod === "coords" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Latitude</label>
                  <input
                    type="text"
                    placeholder="50.3428"
                    value={siteLat}
                    onChange={(e) => setSiteLat(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Longitude</label>
                  <input
                    type="text"
                    placeholder="-3.5658"
                    value={siteLng}
                    onChange={(e) => setSiteLng(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                    required
                  />
                </div>
              </div>
            )}

            {inputMethod === "w3w" && (
              <div>
                <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">what3words Address</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-brand-yellow font-extrabold text-xs">///</span>
                  <input
                    type="text"
                    placeholder="filled.count.soap"
                    value={w3wInput.replace(/^\/{3}/, "")}
                    onChange={(e) => setW3wInput(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-955 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                    required
                  />
                </div>
              </div>
            )}

            {inputMethod === "postcode" && (
              <div>
                <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">UK Postcode</label>
                <input
                  type="text"
                  placeholder="e.g. TQ6 9JN"
                  value={postcodeInput}
                  onChange={(e) => setPostcodeInput(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Location Type</label>
                <select
                  value={siteType}
                  onChange={(e) => setSiteType(e.target.value as any)}
                  className="w-full h-9 px-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                  required
                >
                  <option value="geofence">Rota Geofence Area</option>
                  <option value="merchant">Local Merchant / Supplier</option>
                  <option value="global">Global Location (e.g. Head Office)</option>
                  <option value="admin">Admin Area (e.g. Manager Office)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Boundary Radius (m)</label>
                <input
                  type="number"
                  placeholder="100"
                  value={siteRadius}
                  onChange={(e) => setSiteRadius(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                  min="10"
                  max="5000"
                  required
                />
              </div>
            </div>

            {siteType === "admin" && (
              <div>
                <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Associated Rota Site</label>
                <select
                  value={associatedSiteId}
                  onChange={(e) => setAssociatedSiteId(e.target.value)}
                  className="w-full h-9 px-2 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm"
                  required
                >
                  <option value="">Global / All Sites</option>
                  {sites.filter(s => s.type !== "admin").map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-455 font-bold uppercase tracking-wider block mb-1">Validation Checkpoint Times</label>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newTimeInput}
                  onChange={(e) => setNewTimeInput(e.target.value)}
                  className="grow h-9 px-3 bg-slate-950 border border-slate-800 text-slate-200 outline-none focus:border-brand-blue text-sm rounded-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTimeInput && !validationTimes.includes(newTimeInput)) {
                      setValidationTimes(prev => [...prev, newTimeInput].sort());
                      setNewTimeInput("");
                    }
                  }}
                  className="h-9 px-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-slate-100 text-xs font-bold uppercase tracking-wider transition rounded-none shrink-0"
                >
                  + Add Time
                </button>
              </div>

              {validationTimes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {validationTimes.map((time) => (
                    <span key={time} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-950 border border-slate-850 text-xs font-bold text-slate-300">
                      <span>{time}</span>
                      <button
                        type="button"
                        onClick={() => setValidationTimes(prev => prev.filter(t => t !== time))}
                        className="text-slate-500 hover:text-brand-red font-bold text-xs"
                        title="Remove checkpoint"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-9 bg-brand-blue hover:bg-blue-600 text-slate-955 font-bold uppercase tracking-wider text-center cursor-pointer transition rounded-none text-xs"
            >
              Add New Active Site
            </button>
          </form>

          {formMsg && <div className="text-xs text-brand-yellow font-bold animate-pulse">{formMsg}</div>}

          {/* Helpful Lookup Links */}
          <div className="bg-slate-950/80 border border-slate-850 p-3.5 space-y-2 font-mono text-[11px] leading-normal">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Helpful Location Tools</span>
            <div className="flex gap-4">
              <a 
                href="https://what3words.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-brand-yellow hover:text-yellow-400 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <span>what3words Maps</span>
              </a>
              <a 
                href="https://www.latlong.net" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-brand-blue hover:text-blue-400 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <span>Latitude/Longitude Finder</span>
              </a>
            </div>
          </div>

          {/* Site List */}
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <span className="text-xs text-slate-450 font-bold uppercase tracking-wider block">Active Geofenced Zones ({sites.length})</span>
            <div className="max-h-52 overflow-y-auto space-y-3.5 divide-y divide-slate-800 pr-1">
              {sites.map((site) => {
                const badgeColor = site.type === "global" ? "bg-purple-950/70 text-purple-400 border-purple-800/60" :
                                   site.type === "merchant" ? "bg-amber-950/70 text-brand-yellow border-amber-800/60" :
                                   site.type === "admin" ? "bg-emerald-950/70 text-emerald-400 border-emerald-800/60" :
                                   "bg-blue-950/70 text-brand-blue border-blue-800/60";
                const typeLabel = site.type === "global" ? "Global" :
                                  site.type === "merchant" ? "Merchant" :
                                  site.type === "admin" ? "Admin" :
                                  "Geofence";
                return (
                  <div key={site.id} className="pt-2 text-sm space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div className="truncate pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{site.name}</span>
                          <span className={`px-1.5 py-0.5 text-[9px] font-extrabold border rounded-none uppercase leading-none ${badgeColor}`}>
                            {typeLabel}
                          </span>
                        </div>
                        <span className="text-slate-500 font-semibold block text-xs mt-0.5">
                          Radius: {site.radius}m | ({site.lat.toFixed(4)}, {site.lng.toFixed(4)})
                        </span>
                        {site.type === "admin" && (
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                            Linked to: {site.associatedSiteId ? (sites.find(s => s.id === site.associatedSiteId)?.name || "Unknown Site") : "Global / All Sites"}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSite(site.id, site.name)}
                        className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-brand-red rounded transition cursor-pointer"
                        title="Delete site"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Site validation times manager */}
                    <div className="pl-2 border-l border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Checkpoints:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(site.validationTimes || []).map((time) => (
                          <span key={time} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-950 border border-slate-850 text-[10px] font-bold text-slate-400">
                            <span>{time}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveValidationTime(site.id, time)}
                              className="text-slate-600 hover:text-brand-red font-bold text-xs"
                              title="Remove checkpoint"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {(site.validationTimes || []).length === 0 && (
                          <span className="text-[10px] text-slate-650 italic">None configured</span>
                        )}
                      </div>
                      
                      {/* Add validation time input */}
                      <div className="flex gap-1 items-center pt-1">
                        <input
                          type="text"
                          placeholder="HH:MM"
                          value={newTimeInputs[site.id] || ""}
                          onChange={(e) => setNewTimeInputs(prev => ({ ...prev, [site.id]: e.target.value }))}
                          className="h-6 w-14 px-1 bg-slate-950 border border-slate-850 text-slate-300 outline-none text-[10px] rounded-none font-bold text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddValidationTimeDirect(site.id)}
                          className="h-6 px-2 bg-slate-950 hover:bg-slate-850 border border-slate-805 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-none transition"
                        >
                          + Add
                        </button>
                      </div>
                    </div>

                    {/* Transit Destinations manager */}
                    <div className="pl-2 border-l border-slate-800 space-y-1 mt-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Likely Transit Destinations:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(site.transitDestinations || []).map((dest) => (
                          <span key={dest.name} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-950 border border-slate-850 text-[10px] font-bold text-slate-400">
                            <span>{dest.name} ({dest.address})</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTransitDestination(site.id, dest.name)}
                              className="text-slate-650 hover:text-brand-red font-bold text-xs"
                              title="Remove destination"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        {(site.transitDestinations || []).length === 0 && (
                          <span className="text-[10px] text-slate-650 italic">None configured</span>
                        )}
                      </div>
                      
                      {/* Add transit destination input form */}
                      <div className="flex gap-1 items-center pt-1.5">
                        <input
                          type="text"
                          id={`dest-name-${site.id}`}
                          placeholder="Name (e.g. Depot)"
                          className="h-6 w-20 px-1 bg-slate-955 border border-slate-850 text-slate-350 outline-none text-[10px] rounded-none font-bold"
                        />
                        <input
                          type="text"
                          id={`dest-addr-${site.id}`}
                          placeholder="Address (postcode/w3w)"
                          className="h-6 w-24 px-1 bg-slate-955 border border-slate-850 text-slate-355 outline-none text-[10px] rounded-none font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nameInput = document.getElementById(`dest-name-${site.id}`) as HTMLInputElement;
                            const addrInput = document.getElementById(`dest-addr-${site.id}`) as HTMLInputElement;
                            if (nameInput && addrInput && nameInput.value.trim() && addrInput.value.trim()) {
                              handleAddTransitDestination(site.id, nameInput.value.trim(), addrInput.value.trim());
                              nameInput.value = "";
                              addrInput.value = "";
                            }
                          }}
                          className="h-6 px-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-805 text-slate-400 hover:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-none transition"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Validate Now Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <Bell className="w-5 h-5 text-brand-yellow animate-pulse" />
            <span>Validate Now (Instant Check-In)</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-450 font-bold uppercase tracking-wider block mb-1">Target Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInstantTargetType("site");
                    setInstantTargetIds([]);
                  }}
                  className={`flex-1 h-8 text-[11px] font-bold uppercase tracking-wider border rounded-none transition cursor-pointer ${
                    instantTargetType === "site"
                      ? "bg-brand-yellow border-brand-yellow text-slate-955"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  By Work Zone (Sites)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInstantTargetType("staff");
                    setInstantTargetIds([]);
                  }}
                  className={`flex-1 h-8 text-[11px] font-bold uppercase tracking-wider border rounded-none transition cursor-pointer ${
                    instantTargetType === "staff"
                      ? "bg-brand-yellow border-brand-yellow text-slate-955"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  By Staff Member
                </button>
              </div>
            </div>

            {/* Checkbox List */}
            <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-850 p-2 bg-slate-950">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer pb-1.5 border-b border-slate-800">
                <input
                  type="checkbox"
                  checked={
                    instantTargetType === "site"
                      ? instantTargetIds.length === sites.length && sites.length > 0
                      : instantTargetIds.length === staffList.length && staffList.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      const allIds = instantTargetType === "site" ? sites.map(s => s.id) : staffList.map(s => s.id);
                      setInstantTargetIds(allIds);
                    } else {
                      setInstantTargetIds([]);
                    }
                  }}
                  className="accent-brand-yellow"
                />
                <span>Select All {instantTargetType === "site" ? "Sites" : "Staff"}</span>
              </label>

              {instantTargetType === "site" ? (
                sites.map(site => (
                  <label key={site.id} className="flex items-center gap-2 text-xs text-slate-350 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={instantTargetIds.includes(site.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInstantTargetIds(prev => [...prev, site.id]);
                        } else {
                          setInstantTargetIds(prev => prev.filter(id => id !== site.id));
                        }
                      }}
                      className="accent-brand-yellow"
                    />
                    <span>{site.name}</span>
                  </label>
                ))
              ) : (
                staffList.map(staff => (
                  <label key={staff.id} className="flex items-center gap-2 text-xs text-slate-350 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={instantTargetIds.includes(staff.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInstantTargetIds(prev => [...prev, staff.id]);
                        } else {
                          setInstantTargetIds(prev => prev.filter(id => id !== staff.id));
                        }
                      }}
                      className="accent-brand-yellow"
                    />
                    <span>{staff.name}</span>
                  </label>
                ))
              )}
            </div>

            <button
              onClick={handleDispatchInstantValidation}
              disabled={instantTargetIds.length === 0}
              className="w-full h-9 bg-brand-yellow hover:bg-amber-500 disabled:opacity-50 text-slate-955 font-bold uppercase tracking-wider text-center cursor-pointer transition rounded-none text-xs"
            >
              Request Validation Now ({instantTargetIds.length})
            </button>

            {dispatchMsg && <div className="text-xs text-brand-yellow font-bold animate-pulse text-center">{dispatchMsg}</div>}
          </div>
        </div>

        {/* Chronological Timeline list */}
        <div className="bg-slate-900 border border-slate-800 p-5 space-y-4 grow flex flex-col max-h-[300px] lg:max-h-[352px]">
          <h3 className="text-base font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2.5">
            <ListOrdered className="w-5 h-5 text-brand-yellow" />
            <span>Shift Activity Log</span>
          </h3>

          <div className="overflow-y-auto grow space-y-3.5 pr-1 text-sm">
            {events.length === 0 ? (
              <div className="text-slate-500 italic text-xs text-center py-10">No location logs registered for this shift.</div>
            ) : (
              <div className="relative border-l border-slate-800 ml-3 pl-5 space-y-5">
                {events.map((evt, index) => {
                  let badgeColor = "bg-brand-red"; 
                  let typeText = "Checked On-Site";

                  const matchedSite = sites.find(s => evt.locationName.includes(s.name));
                  if (matchedSite) {
                    badgeColor = getSiteColor(matchedSite.name).bg;
                  } else if (evt.type === "depart") {
                    badgeColor = "bg-brand-yellow text-slate-955";
                    typeText = "Transit Depart";
                  } else if (evt.type === "return") {
                    badgeColor = "bg-emerald-500 text-slate-955";
                    typeText = "Returned On-Site";
                  }

                  return (
                    <div key={evt.id} className="relative text-sm">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[30px] top-0.5 rounded-full border border-slate-950 text-xs w-6 h-6 flex items-center justify-center font-bold font-mono shadow-md ${badgeColor}`}>
                        {index + 1}
                      </span>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-100">{typeText}</span>
                          <span className="text-xs text-slate-550 flex items-center gap-1 font-semibold">
                            <Calendar className="w-3 h-3" />
                            {new Date(evt.timestamp).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-400 font-semibold leading-tight">{evt.locationName}</p>
                        {evt.staffName && (
                          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            Staff: {evt.staffName}
                          </div>
                        )}
                        {evt.what3words && (
                          <div className="text-brand-yellow font-bold text-xs uppercase">
                            what3words: {evt.what3words}
                          </div>
                        )}
                        {evt.expectedReturn && (
                          <div className="text-slate-500 text-xs font-semibold">
                            Expected back: {evt.expectedReturn}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
