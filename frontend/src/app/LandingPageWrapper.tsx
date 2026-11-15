"use client";

import dynamic from "next/dynamic";

const LandingPageClient = dynamic(() => import("./LandingPageClient"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 font-mono text-sm">Loading Chronospectra...</p>
      </div>
    </div>
  ),
});

export default function LandingPageWrapper() {
  return <LandingPageClient />;
}