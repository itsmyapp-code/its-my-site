"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Shield } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-8 font-mono text-xs space-y-6">
      
      {/* Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-slate-400 hover:text-brand-blue uppercase font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <span className="text-slate-500 font-semibold text-[9px] uppercase">UK Compliance Framework</span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-blue" />
          <span>Terms of Service</span>
        </h1>
        <p className="text-slate-500 text-[10px]">Last Updated: 2026-07-14T10:37:52.000Z</p>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5 text-slate-300 leading-relaxed">
        
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">1. Agreement to Terms</h2>
          <p>
            By accessing or using the "itsmysite" geofencing and shift validation application (the "Service"), 
            provided by itsmyapp.co.uk ("we," "our," or "us"), you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, you must not access or use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">2. Geofence & Location Validation</h2>
          <p>
            The Service utilizes the HTML5 Geolocation API on your device to perform voluntary site-check-ins and validation. 
            Under our strict zero-surveillance design:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>We do NOT track your device location passively in the background.</li>
            <li>Location coordinates are captured and processed ONLY when you explicitly respond to validation prompts or trigger transit/check-in logs.</li>
            <li>Coordinates are compared locally or inside isolated database paths scoped exclusively to your UID.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">3. Zero-Server and Client Storage</h2>
          <p>
            The Service utilizes a "Zero Server" runtime style. Data is persisted in your browser's LocalStorage and 
            scoped user directories in Firebase Firestore client-side SDK. You are responsible for clearing your browser storage 
            should you wish to remove local cached data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">4. User Account Scoping</h2>
          <p>
            All user data, logs, and site configurations are restricted strictly to paths matching `users/[uid]/` within 
            our database architecture. You are prohibited from attempting to bypass this path isolation. Bypassing or attempting 
            to read outside your user directory will lead to immediate account termination.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">5. Fair Subscription & Single-Click Exit</h2>
          <p>
            Subscriptions to our platform are billed transparently with all VAT and platform fees shown upfront (Anti-Drip pricing). 
            You retain a 14-day statutory cooling-off window (UK Consumer Contracts Regulations) to cancel and request a full refund online. 
            All subscriptions can be terminated immediately with a single-click cancellation toggle in the billing dashboard, with no phone calls or questionnaire loops required.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">6. Contact Information</h2>
          <p>
            For any statutory inquiries, dispute resolutions, or terms of service compliance matters, contact us at:
            <br />
            <strong className="text-slate-100">Email: hello@itsmyapp.co.uk</strong>
          </p>
        </section>

      </div>
    </div>
  );
}
