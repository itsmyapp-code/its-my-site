"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Accessibility, CheckSquare } from "lucide-react";

export default function AccessibilityPage() {
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
          <Accessibility className="w-5 h-5 text-brand-blue" />
          <span>Accessibility Statement</span>
        </h1>
        <p className="text-slate-500 text-[10px]">Last Updated: 2026-07-14T10:37:52.000Z</p>
      </div>

      {/* Content */}
      <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-5 text-slate-300 leading-relaxed">
        
        <div className="p-3.5 bg-blue-950/70 border border-brand-blue/30 text-blue-300 rounded-none leading-normal">
          <strong>WCAG AAA CONTRAST STATEMENT:</strong> We formally target a minimum 7:1 contrast ratio on all textual interfaces. This ensures optimal readability for operators using field devices in diverse lighting conditions (outdoors, high sunlight, or low night lighting).
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">1. Our Commitment</h2>
          <p>
            itsmyapp.co.uk is committed to ensuring digital accessibility for people of all abilities. We are continually 
            improving the user experience for everyone, applying relevant accessibility standards, and targeting compliance 
            with Web Content Accessibility Guidelines (WCAG) 2.2 Level AAA.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">2. Accessibility Features</h2>
          <p>
            This application incorporates the following features designed to enhance usability:
          </p>
          <ul className="list-disc pl-4 space-y-2">
            <li>
              <strong>High-Contrast Monospace Typography:</strong> By employing JetBrains Mono and high-contrast color tokens 
              (such as pure white text on deep slate-950 backgrounds), we exceed standard contrast requirements.
            </li>
            <li>
              <strong>Keyboard Navigation:</strong> All critical interactive controls (cookie consent, validation dispatch prompts, 
              geofence checkpoints, and subscription exits) feature standard tabindex formatting and focus indicators.
            </li>
            <li>
              <strong>ARIA Semantics:</strong> We employ standard semantic HTML elements (nav, main, footer, sections) 
              with appropriate role declarations for screen reader compatibility.
            </li>
            <li>
              <strong>Explicit Interactive Identifiers:</strong> Every button, input, and anchor is coded with unique, descriptive 
              IDs and labels to facilitate automated browser testing and assistive technology compatibility.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">3. Limitations and Alternatives</h2>
          <p>
            Despite our best efforts, some components may present challenges:
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong>Interactive Mapping:</strong> The Leaflet.js tracking map relies heavily on visual coordinate rendering. 
              To support screen-reader operators, we provide an equivalent text-based chronological "Shift Activity Log" 
              directly alongside the map container.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider text-brand-yellow">4. Feedback & Support</h2>
          <p>
            We welcome your feedback on the accessibility of this application. If you encounter accessibility barriers, 
            please let us know by contacting our Data Privacy and Accessibility Lead directly:
            <br />
            <strong className="text-slate-100">Email: hello@itsmyapp.co.uk</strong>
            <br />
            We formally respond to accessibility inquiries within 30 days.
          </p>
        </section>

      </div>
    </div>
  );
}
