"use client"

import dynamic from 'next/dynamic'

const QRScanner = dynamic(() => import('@/components/qr-scanner'), { ssr: false })

export default function QRScannerPage() {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">QR Code Scanner</h1>
      <p className="text-gray-600 mb-6">Scan attendee tickets to validate entry. Hold the QR code in front of your camera or enter the code manually.</p>
      <QRScanner />
    </div>
  )
} 