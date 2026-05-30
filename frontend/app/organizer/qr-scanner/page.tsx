"use client"

import dynamic from 'next/dynamic'

const QRScanner = dynamic(() => import('@/components/qr-scanner'), { ssr: false })

export default function QRScannerPage() {
  return (
    <QRScanner />
  )
} 
