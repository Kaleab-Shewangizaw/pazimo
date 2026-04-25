"use client"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { QrCode, CheckCircle, XCircle, User, Calendar, Clock, Ticket as TicketIcon, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Html5QrcodeScanner } from "html5-qrcode"

interface TicketData {
  ticketId: string
  eventTitle: string
  userName: string
  userEmail: string
  eventDate: string
  ticketType: string
  ticketCount: number
  checkedIn: boolean
  alreadyCheckedIn?: boolean
  price?: number
}

export default function QRScanner() {
  const [scannedData, setScannedData] = useState<string>("")
  const [ticketInfo, setTicketInfo] = useState<TicketData | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null)
  const [checkInQuantity, setCheckInQuantity] = useState<number>(1)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    if (!ticketInfo) {
      if (!scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        )
        
        scannerRef.current.render(
          (decodedText) => {
            scannerRef.current?.pause(true);
            verifyTicket(decodedText)
          },
          (error) => {
            // ignore background errors
          }
        )
      } else {
        scannerRef.current.resume();
      }
    }

    return () => {
      // We don't necessarily want to clear immediately when ticketInfo is set
      // because we want to reuse the DOM element quickly if "Scan Another" is clicked.
      // But passing false to clear helps properly unmount if the component actually dies.
    }
  }, [ticketInfo])

  // Proper cleanup on true unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error)
        })
        scannerRef.current = null;
      }
    }
  }, [])

  const verifyTicket = async (qrData: string) => {
    setIsVerifying(true)
    setScanResult(null)
    setScannedData(qrData)
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/validate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ qrData }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setTicketInfo({
          ...result.data,
          alreadyCheckedIn: result.alreadyCheckedIn
        })
        setScanResult(result.alreadyCheckedIn ? 'error' : 'success')
        setCheckInQuantity(1)
        toast.success(result.alreadyCheckedIn ? 'Ticket is already checked in' : 'Ticket found')
      } else {
        setScanResult('error')
        toast.error(result.message || 'Ticket verification failed')
        if (scannerRef.current) scannerRef.current.resume();
      }
    } catch (error) {
      console.error('Verification error:', error)
      setScanResult('error')
      toast.error('Failed to verify QR code')
      if (scannerRef.current) scannerRef.current.resume();
    } finally {
      setIsVerifying(false)
    }
  }

  const handleManualInput = () => {
    if (scannedData.trim()) {
      if (scannerRef.current) scannerRef.current.pause(true);
      verifyTicket(scannedData)
    }
  }

  const handleCheckIn = async () => {
    if (!ticketInfo) return;
    
    setIsCheckingIn(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticketInfo.ticketId}/check-in`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ count: checkInQuantity }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast.success(result.message || 'Ticket checked in successfully')
        setTicketInfo(prev => prev ? { 
          ...prev, 
          ticketCount: result.data?.remainingUses ?? Math.max(0, prev.ticketCount - checkInQuantity),
          checkedIn: result.data?.fullyUsed ?? true,
          alreadyCheckedIn: result.data?.fullyUsed ?? true
        } : null)
        setScanResult('success')
      } else {
        toast.error(result.message || 'Check-in failed')
      }
    } catch (error) {
      console.error('Check-in error:', error)
      toast.error('An error occurred while checking in')
    } finally {
      setIsCheckingIn(false)
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
            <ScanLine className="h-5 w-5" />
            Scanner Tool
          </CardTitle>
          <CardDescription>
            Scan QR code or enter manual data to verify tickets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={ticketInfo ? "hidden" : "block"}>
            <div id="qr-reader" className="w-full overflow-hidden rounded-lg border border-gray-200 mb-4 bg-gray-50 min-h-[300px]"></div>
            
            <div className="pt-4 border-t border-gray-200">
              <label className="block text-sm font-medium mb-2">
                Or paste QR data manually:
              </label>
              <textarea
                value={scannedData}
                onChange={(e) => setScannedData(e.target.value)}
                placeholder="Paste QR code JSON here..."
                className="w-full p-3 border rounded-lg h-24 text-sm mb-3"
              />
              <Button 
                onClick={handleManualInput}
                disabled={!scannedData.trim() || isVerifying}
                className="w-full"
              >
                {isVerifying ? "Verifying..." : "Verify Manually"}
              </Button>
            </div>
          </div>
          
          {ticketInfo && (
            <div className="space-y-4">
              {ticketInfo.alreadyCheckedIn ? (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">Ticket Already Used or Invalid</span>
                </div>
              ) : ticketInfo.checkedIn ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">Ticket Successfully Checked In</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-blue-800 font-medium">Ticket Found - Ready for Check In</span>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-lg">{ticketInfo.userName}</span>
                </div>
                {ticketInfo.userEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 ml-6">
                    <span>{ticketInfo.userEmail}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 mt-4">
                  <Calendar className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">{ticketInfo.eventTitle}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <TicketIcon className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-semibold capitalize text-blue-700">{ticketInfo.ticketType} Ticket</span>
                </div>
                
                <div className="flex items-center justify-between mt-4 p-3 bg-white border rounded-md">
                  <span className="text-sm text-gray-700 font-medium">Available Uses:</span>
                  <span className="text-lg font-bold text-gray-900">{ticketInfo.ticketCount}</span>
                </div>

                <div className="text-xs text-gray-500 mt-2 break-all">
                  ID: {ticketInfo.ticketId}
                </div>
              </div>

              {!ticketInfo.checkedIn && !ticketInfo.alreadyCheckedIn && ticketInfo.ticketCount > 0 && (
                <div className="p-4 border rounded-lg bg-gray-50">
                  <label className="block text-sm font-medium mb-2 text-gray-800">
                    Quantity to Check In:
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      min={1} 
                      max={ticketInfo.ticketCount} 
                      value={checkInQuantity}
                      onChange={(e) => setCheckInQuantity(Math.min(ticketInfo.ticketCount, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="border-gray-300"
                    />
                    <Button 
                      onClick={handleCheckIn}
                      disabled={isCheckingIn || ticketInfo.ticketCount < 1}
                      className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                    >
                      {isCheckingIn ? "Processing..." : "Check In"}
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={resetScanner} variant="outline" className="w-full mt-4 border-gray-300">
                Scan Another Ticket
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}