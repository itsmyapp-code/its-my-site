"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Eye } from "lucide-react";

export default function PrivacyPage() {
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
          <Shield className="w-5 h-5 text-brand-blue" />
          <span>Privacy Policy (UK GDPR)</span>
        </h1>
        <p className="text-slate-500 text-[10px]">Last Updated: 2026-07-14T10:37:52.000Z</p>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5 text-slate-300 leading-relaxed">
        
        <div className="p-3.5 bg-blue-950/70 border border-brand-blue/30 text-blue-300 rounded-none leading-normal">
          <strong>UK GDPR COMPLIANCE DECLARATION:</strong> This Service is built in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. We operate a zero-surveillance architecture with client-side isolation.
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">1. Data Controller</h2>
          <p>
            The Data Controller for this Service is itsmyapp.co.uk. For any queries, rights requests, or compliance submissions, 
            please contact our Data Privacy Lead at <strong className="text-slate-100">hello@itsmyapp.co.uk</strong>. 
            We formally acknowledge and respond to all compliance inquiries within 30 days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">2. Data We Collect and Processing Purposes</h2>
          <p>
            Under Article 6 of the UK GDPR, our lawful bases for processing are:
          </p>
          <ul className="list-disc pl-4 space-y-2">
            <li>
              <strong>Performance of a Contract:</strong> Voluntary check-in tracking and off-site transits which you declare. 
              Coordinates are requested only at response windows and are never stored continuously in the background.
            </li>
            <li>
              <strong>Legal Obligation (Article 24 Compliance):</strong> Security log auditing. We write cryptographic logs of session events 
              to verify the technical security and compliance profile of the app.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">3. Data Scoping & Separation</h2>
          <p>
            All personal identifiers and location check-ins are programmatically scoped under your Firebase Auth UID (`users/[uid]/`). 
            We do not combine database paths across users, nor do we run cross-tenant data processing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">4. Storage and Data Retention</h2>
          <p>
            We host data client-side in your local browser Cache/LocalStorage and in Firestore with offline capability. 
            Audit logs are archived and retained for 1 year in our private repositories to meet compliance accountability checks 
            under Article 24 of the UK GDPR.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">5. Your Data Rights</h2>
          <p>
            Under UK GDPR, you have the right to request access to your data, rectification of errors, portability of logs, 
            and complete erasure ("right to be forgotten"). Since all data is stored client-side or under your UID, 
            you can execute erasure requests directly by resetting your browser cache or deleting your Firebase user profile.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">6. Supervisory Authority</h2>
          <p>
            If you believe our data processing violates UK GDPR guidelines, you have the right to lodge a formal complaint 
            with the Information Commissioner's Office (ICO) in the United Kingdom (ico.org.uk).
          </p>
        </section>

      </div>
    </div>
  );
}
