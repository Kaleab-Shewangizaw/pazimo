"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QrCode, CheckCircle, XCircle, User, Calendar, Clock } from "lucide-react"
import { toast } from "sonner"

interface TicketData {
  ticketNumber: string
  eventTitle: string
  customerName: string
  contact: string
  eventDate: string
  eventTime: string
  guestType: string
}

export default function QRScanner() {
  const [scannedData, setScannedData] = useState<string>("")
  const [ticketInfo, setTicketInfo] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null)

  const handleManualInput = (data: string) => {
    setScannedData(data)
    if (data.trim()) {
      verifyTicket(data)
    }
  }

  const verifyTicket = async (qrData: string) => {
    setIsVerifying(true)
    setScanResult(null)
    
    try {
      // Parse QR code data
      const ticketData: TicketData = JSON.parse(qrData)
      
      // Verify ticket with backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/qr-tickets/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber: ticketData.ticketNumber
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setTicketInfo({
          ...ticketData,
          status: 'used',
          verifiedAt: new Date().toISOString()
        })
        setScanResult('success')
        toast.success('Ticket verified successfully - Status changed to USED')
      } else {
        setScanResult('error')
        toast.error(result.error || 'Ticket verification failed')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setScanResult('error')
      toast.error('Invalid QR code format')
    } finally {
      setIsVerifying(false)
    }
  }

  const resetScanner = () => {
    setScannedData("")
    setTicketInfo(null)
    setScanResult(null)
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Ticket Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ticketInfo ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Scan or paste QR code data:
                </label>
                <textarea
                  value={scannedData}
                  onChange={(e) => setScannedData(e.target.value)}
                  placeholder="Paste QR code data here..."
                  className="w-full p-3 border rounded-lg h-24 text-sm"
                />
              </div>
              <Button 
                onClick={() => handleManualInput(scannedData)}
                disabled={!scannedData.trim() || isVerifying}
                className="w-full"
              >
                {isVerifying ? "Verifying..." : "Verify Ticket"}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              {scanResult === 'success' && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">Ticket Verified - Status: USED</span>
                </div>
              )}
              
              {scanResult === 'error' && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">Verification Failed</span>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">{ticketInfo.customerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">{ticketInfo.eventTitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <span className="text-sm">{ticketInfo.eventDate} at {ticketInfo.eventTime}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Ticket: {ticketInfo.ticketNumber} | Type: {ticketInfo.guestType}
                </div>
              </div>

              <Button onClick={resetScanner} variant="outline" className="w-full">
                Scan Another Ticket
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}