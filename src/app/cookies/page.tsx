"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Cookie, Info } from "lucide-react";

export default function CookiesPage() {
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
          <Cookie className="w-5 h-5 text-brand-blue" />
          <span>Cookie Policy</span>
        </h1>
        <p className="text-slate-500 text-[10px]">Last Updated: 2026-07-14T10:37:52.000Z</p>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5 text-slate-300 leading-relaxed">
        
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">1. What are Cookies?</h2>
          <p>
            Cookies and local storage data are small text files placed on your device to store preferences, login tokens, 
            and configuration details when you access web apps. 
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">2. Lawful Consent & Blockades</h2>
          <p>
            In strict compliance with UK GDPR and PECR (Privacy and Electronic Communications Regulations):
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>We operate a <strong>zero-load blockade</strong>. No optional analytical, tracking, or conversion scripts are loaded until you explicitly click "Accept All".</li>
            <li>We offer an immediate <strong>Reject All</strong> button on the primary interface. Rejecting optional tracking does not restrict access to the application's core functions.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">3. Strictly Necessary Cookies (Consent Exempt)</h2>
          <p>
            Under UK legislation (Data Use and Access Act exemptions), consent requests are omitted for key operational tasks. 
            We store session authentication states, geofence definitions, and audit registers locally. 
            These are classified as "strictly necessary" to deliver the service and cannot be turned off.
          </p>
          
          {/* Table of Cookies */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full border-collapse border border-slate-800 text-left text-[11px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-850">
                  <th className="p-2 border-r border-slate-800">Storage Key</th>
                  <th className="p-2 border-r border-slate-800">Provider</th>
                  <th className="p-2 border-r border-slate-800">Purpose</th>
                  <th className="p-2">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <tr>
                  <td className="p-2 border-r border-slate-800 font-bold text-slate-200">itsmysite_cookie_consent</td>
                  <td className="p-2 border-r border-slate-800">First-Party</td>
                  <td className="p-2 border-r border-slate-800">Remembers your GDPR consent preferences (Strictly Necessary).</td>
                  <td className="p-2">Persistent</td>
                </tr>
                <tr>
                  <td className="p-2 border-r border-slate-800 font-bold text-slate-200">itsmysite_sites_[uid]</td>
                  <td className="p-2 border-r border-slate-800">First-Party</td>
                  <td className="p-2 border-r border-slate-800">Stores geofenced sites for offline checking.</td>
                  <td className="p-2">Persistent</td>
                </tr>
                <tr>
                  <td className="p-2 border-r border-slate-800 font-bold text-slate-200">itsmysite_events_[uid]</td>
                  <td className="p-2 border-r border-slate-800">First-Party</td>
                  <td className="p-2 border-r border-slate-800">Stores shift check-ins and transits (Strictly Necessary).</td>
                  <td className="p-2">Persistent</td>
                </tr>
                <tr>
                  <td className="p-2 border-r border-slate-800 font-bold text-slate-200">itsmysite_settings_[uid]</td>
                  <td className="p-2 border-r border-slate-800">First-Party</td>
                  <td className="p-2 border-r border-slate-800">Stores billing, renewal, and cooling-off variables.</td>
                  <td className="p-2">Persistent</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">4. How to Manage Consent</h2>
          <p>
            You can reset your cookie settings at any time by clicking the small floating "Cookies" widget at the bottom-left 
            of the screen. Clicking it re-opens the consent dialog where you can change your selection instantly.
          </p>
        </section>

      </div>
    </div>
  );
}
