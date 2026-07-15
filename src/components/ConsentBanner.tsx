"use client";

import React, { useState, useEffect } from "react";
import { Shield, ShieldAlert, Check, X } from "lucide-react";
import { dbAddAuditLog } from "@/lib/db";

export function ConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [consentState, setConsentState] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedConsent = localStorage.getItem("itsmysite_cookie_consent");
      if (storedConsent === "accepted" || storedConsent === "rejected") {
        setConsentState(storedConsent as "accepted" | "rejected");
        if (storedConsent === "rejected") {
          disableTracking();
        }
      } else {
        setShowBanner(true);
      }
    }
  }, []);

  const disableTracking = () => {
    (window as any).gaOptout = true;
  };

  const handleAccept = async () => {
    localStorage.setItem("itsmysite_cookie_consent", "accepted");
    setConsentState("accepted");
    setShowBanner(false);
    
    await dbAddAuditLog(
      "anonymous-session",
      "GDPR_CONSENT_GIVEN",
      "User accepted optional telemetry and analytical cookie execution."
    );
  };

  const handleReject = async () => {
    localStorage.setItem("itsmysite_cookie_consent", "rejected");
    setConsentState("rejected");
    setShowBanner(false);
    disableTracking();

    await dbAddAuditLog(
      "anonymous-session",
      "GDPR_CONSENT_REJECTED",
      "User rejected optional cookies. Enforced zero-telemetry script blockades."
    );
  };

  const handleReset = () => {
    localStorage.removeItem("itsmysite_cookie_consent");
    setConsentState(null);
    setShowBanner(true);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-5 md:p-6 bg-slate-950/98 border-t border-brand-blue/30 backdrop-blur-md font-mono text-sm">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        
        {/* Consent Info */}
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2 text-brand-yellow font-bold text-base">
            <ShieldAlert className="w-5 h-5 text-brand-yellow" />
            <span>UK GDPR COMPLIANCE & PRIVACY CONTROL</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-sm max-w-5xl font-medium">
            We use strictly necessary cookies for authentication, shift logging, and security audit registers 
            (exempt from consent under the Data Use and Access Act). We request your permission to run optional client-side 
            performance metrics. No third-party tracking scripts or persistent analytical trackers are run without your consent.
          </p>
          <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 font-bold">
            <span>• Zero Telemetry Active</span>
            <span>• Immediate First-Layer Rejection</span>
            <span>• Scoped User Isolation</span>
          </div>
        </div>

        {/* Buttons (EQUAL PROMINENCE COMPLIANCE CHECK) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 justify-end">
          
          <button
            onClick={handleReject}
            id="cookie-reject-button"
            className="w-full sm:w-44 h-11 px-4 py-2.5 border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 active:bg-slate-700 text-center font-bold tracking-wider rounded-none uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
          >
            <X className="w-4 h-4 shrink-0" />
            <span>Reject All</span>
          </button>

          <button
            onClick={handleAccept}
            id="cookie-accept-button"
            className="w-full sm:w-44 h-11 px-4 py-2.5 border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 active:bg-slate-700 text-center font-bold tracking-wider rounded-none uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-sm text-sm"
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>Accept All</span>
          </button>
          
        </div>
      </div>
    </div>
  );
}
