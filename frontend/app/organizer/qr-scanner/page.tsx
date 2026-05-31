"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const QRScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

export default function QRScannerPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black text-white">Loading scanner…</div>}>
      <QRScanner />
    </Suspense>
  );
} 
