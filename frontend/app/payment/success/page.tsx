// "use client"

// import { useEffect, useState, Suspense,useRef } from "react"
// import { useSearchParams, useRouter } from "next/navigation"
// import { toast } from "sonner"
// import { Button } from "@/components/ui/button"
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
// import { Download, HomeIcon } from "lucide-react"
// import Image from "next/image"

// interface Ticket {
//   _id: string
//   ticketId: string
//   ticketType: string
//   event: string
//   user: string
//   purchaseDate: string
//   status: string
//   qrCode: string
// }

// function PaymentSuccessContent() {
//   const searchParams = useSearchParams()
//   const router = useRouter()
//   const [purchasedTickets, setPurchasedTickets] = useState<Ticket[]>([])
//   const [showTicketModal, setShowTicketModal] = useState(false)
//   const [isLoading, setIsLoading] = useState(false)
//   const [currentTicketIndex, setCurrentTicketIndex] = useState(0)
//   const [hasProcessed, setHasProcessed] = useState(false)
//   const [hasError, setHasError] = useState(false)
//   const [errorMessage, setErrorMessage] = useState('')
  
//   const downloadQRCode = (qrCode: string, ticketId: string, ticketType: string) => {
//     const link = document.createElement("a")
//     link.href = qrCode
//     link.download = `ticket-${ticketId}-${ticketType}.png`
//     document.body.appendChild(link)
//     link.click()
//     document.body.removeChild(link)
//     toast.success(`QR code downloaded!`)
//   }
  
//   // Parse parameters directly from searchParams
//   const quantity = searchParams.get('quantity') || '1'
//   const ticketType = searchParams.get('ticketType') || 'Regular'
//   const eventId = searchParams.get('id')
//   const tx_ref = searchParams.get('tx_ref')
//   const processingRef = useRef(false)

  
//   // // useEffect(() => {
//   // //   if (eventId && quantity && ticketType && !hasProcessed) {
//   // //     handleBuyClick()
//   // //   }
//   // // }, [eventId, quantity, ticketType, hasProcessed])

//   // useEffect(() => {
//   //   if (eventId && quantity && ticketType && !hasProcessed && !processingRef.current) {
//   //     processingRef.current = true
//   //     handleBuyClick().finally(() => {
//   //       processingRef.current = false
//   //     })
//   //   }
//   // }, [eventId, quantity, ticketType, hasProcessed])

//   useEffect(() => {
//     if (
//       eventId &&
//       quantity &&
//       ticketType &&
//       !hasProcessed &&
//       !processingRef.current
//     ) {
//       processingRef.current = true
//       handleBuyClick().finally(() => {
//         processingRef.current = false
//       })
//     }
//   }, [eventId, quantity, ticketType, hasProcessed])

//   // const handleBuyClick = async () => {
//   //   const storedAuth = localStorage.getItem("auth-storage")
//   //   if (!storedAuth) {
//   //     toast.error("Please sign in to continue")
//   //     return
//   //   }
    
//   //   try {
//   //     const parsedAuth = JSON.parse(storedAuth)
//   //     const userId = parsedAuth.state?.user?._id
//   //     const authToken = parsedAuth.state?.token
      
//   //     if (!userId || !authToken) {
//   //       toast.error("Authentication required")
//   //       return
//   //     }
      
//   //     setIsLoading(true)
//   //     console.log('Processing ticket purchase:', { eventId, ticketType, quantity, userId })
      
//   //     const requestData = {
//   //       userId,
//   //       ticketType,
//   //       quantity: parseInt(quantity, 10),
//   //       paymentReference: tx_ref || `SUCCESS-${Date.now()}`
//   //     }

//   //     console.log('Sending request data:', requestData)

//   //     const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/buy`, {
//   //       method: "POST",
//   //       headers: {
//   //         "Content-Type": "application/json",
//   //         Authorization: `Bearer ${authToken}`
//   //       },
//   //       body: JSON.stringify(requestData)
//   //     })

//   //     const result = await response.json()
//   //     console.log('API Response:', result)

//   //     if (!response.ok) {
//   //       throw new Error(result.error || result.message || "Ticket purchase failed")
//   //     }

//   //     let tickets = [];
//   //     if (result.tickets && Array.isArray(result.tickets)) {
//   //       tickets = result.tickets;
//   //     } else if (result.data && Array.isArray(result.data)) {
//   //       tickets = result.data;
//   //     } else if (result.status === 'success' && result.tickets) {
//   //       tickets = result.tickets;
//   //     }

//   //     if (tickets.length > 0) {
//   //       console.log('Tickets received:', tickets)
//   //       console.log('QR codes:', tickets.map(t => ({ id: t.ticketId, hasQR: !!t.qrCode })))
//   //       toast.success("Payment processed successfully!")
        
//   //       setPurchasedTickets(tickets)
//   //       setShowTicketModal(true)
//   //       setHasProcessed(true)
//   //     } else {
//   //       throw new Error('No tickets received from server')
//   //     }
//   //   } catch (err: any) {
//   //     console.error('Ticket purchase error:', err)
//   //     setHasError(true)
//   //     setErrorMessage(err.message || 'Payment processing failed')
//   //     toast.error(err.message || 'Payment processing failed')
//   //   } finally {
//   //     setIsLoading(false)
//   //   }
//   // }
//   const handleBuyClick = async () => {
//     const storedAuth = localStorage.getItem("auth-storage")
//     if (!storedAuth) {
//       toast.error("Please sign in to continue")
//       return
//     }

//     try {
//       const parsedAuth = JSON.parse(storedAuth)
//       const userId = parsedAuth.state?.user?._id
//       const authToken = parsedAuth.state?.token

//       if (!userId || !authToken) {
//         toast.error("Authentication required")
//         return
//       }

//       setIsLoading(true)
//       console.log("Processing ticket purchase:", {
//         eventId,
//         ticketType,
//         quantity,
//         userId,
//       })

//       const requestData = {
//         userId,
//         ticketType,
//         quantity: parseInt(quantity as string, 10),
//         paymentReference: tx_ref || `SUCCESS-${Date.now()}`,
//       }

//       console.log("Sending request data:", requestData)

//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/buy`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${authToken}`,
//           },
//           body: JSON.stringify(requestData),
//         }
//       )

//       const result = await response.json()
//       console.log("API Response:", result)

//       if (!response.ok) {
//         throw new Error(result.error || result.message || "Ticket purchase failed")
//       }

//       let tickets: any[] = []
//       if (result.tickets && Array.isArray(result.tickets)) {
//         tickets = result.tickets
//       } else if (result.data && Array.isArray(result.data)) {
//         tickets = result.data
//       } else if (result.status === "success" && result.tickets) {
//         tickets = result.tickets
//       }

//       if (tickets.length > 0) {
//         console.log("Tickets received:", tickets)
//         console.log(
//           "QR codes:",
//           tickets.map((t) => ({ id: t.ticketId, hasQR: !!t.qrCode }))
//         )
//         toast.success("Payment processed successfully!")

//         setPurchasedTickets(tickets)
//         setShowTicketModal(true)
//         setHasProcessed(true) // ✅ ensure effect won’t re-trigger
//       } else {
//         throw new Error("No tickets received from server")
//       }
//     } catch (err: any) {
//       console.error("Ticket purchase error:", err)
//       setHasError(true)
//       setErrorMessage(err.message || "Payment processing failed")
//       toast.error(err.message || "Payment processing failed")
//     } finally {
//       setIsLoading(false)
//     }
//   }
//   return (
//     <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50 py-12">
//       <div className="max-w-4xl mx-auto px-4">
//         <div className="bg-white rounded-xl shadow-lg p-8">
//           <div className="text-center mb-8">
//             <h1 className="text-3xl font-bold text-gray-900 mb-2">
//               {hasProcessed ? "Payment Successful!" : "Processing Payment"}
//             </h1>
//             <p className="text-gray-600 mb-1">
//               {hasProcessed ? "Your tickets are ready!" : "Please wait while we process your order..."}
//             </p>
//           </div>
          
//           <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
//             <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div className="bg-white rounded-lg p-4 text-center">
//                 <div className="text-2xl font-bold text-[#0D47A1] mb-1">{quantity}</div>
//                 <div className="text-sm text-gray-600">Tickets</div>
//               </div>
//               <div className="bg-white rounded-lg p-4 text-center">
//                 <div className="text-lg font-semibold text-gray-900 mb-1">{ticketType}</div>
//                 <div className="text-sm text-gray-600">Ticket Type</div>
//               </div>
//               <div className="bg-white rounded-lg p-4 text-center">
//                 <div className={`text-lg font-semibold mb-1 ${hasProcessed ? 'text-green-600' : 'text-yellow-600'}`}>
//                   {hasProcessed ? 'Complete' : 'Processing'}
//                 </div>
//                 <div className="text-sm text-gray-600">Status</div>
//               </div>
//             </div>
//           </div>
          
//           {isLoading && (
//             <div className="text-center py-8">
//               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D47A1] mx-auto mb-4"></div>
//               <p className="text-[#0D47A1] font-medium">Generating your tickets...</p>
//             </div>
//           )}
          
//           {!isLoading && !hasError && hasProcessed && (
//             <div className="text-center py-8">
//               <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                 <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//                 </svg>
//               </div>
//               <h3 className="text-lg font-semibold text-gray-900 mb-2">Tickets Generated Successfully!</h3>
//               <p className="text-gray-600 mb-4">Tickets: {purchasedTickets.length}</p>
//               <Button 
//                 onClick={() => setShowTicketModal(true)}
//                 className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
//               >
//                 View Tickets
//               </Button>
//             </div>
//           )}
          
//           {hasError && (
//             <div className="text-center py-8">
//               <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                 <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
//                 </svg>
//               </div>
//               <h3 className="text-lg font-semibold text-red-600 mb-2">Payment Failed</h3>
//               <p className="text-gray-600 mb-4">{errorMessage}</p>
//               <Button onClick={() => router.push('/')} className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white">
//                 <HomeIcon className="h-4 w-4 mr-2" />
//                 Return Home
//               </Button>
//             </div>
//           )}
//         </div>
//       </div>

//       <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
//         <DialogContent className="max-w-lg">
//           <DialogHeader>
//             <DialogTitle>🎟 Your Tickets</DialogTitle>
//             <DialogDescription>Show these QR codes at the venue for check-in.</DialogDescription>
//           </DialogHeader>
          
//           {purchasedTickets.length > 0 && (
//             <div className="mt-4">
//               <div className="border p-4 rounded-lg bg-white shadow-sm text-center">
//                 <p className="text-sm mb-2 font-medium">
//                   Ticket #{currentTicketIndex + 1} of {purchasedTickets.length}
//                 </p>
//                 <p className="text-xs text-gray-500 mb-4">ID: {purchasedTickets[currentTicketIndex]?.ticketId}</p>
                
//                 {purchasedTickets[currentTicketIndex]?.qrCode ? (
//                   <div className="mb-4">
//                     <div className="bg-white p-4 rounded-lg border inline-block">
//                       <Image
//                         src={purchasedTickets[currentTicketIndex].qrCode}
//                         alt="QR Code"
//                         width={200}
//                         height={200}
//                         className="mx-auto"
//                       />
//                     </div>
//                     <div className="mt-3">
//                       <Button
//                         onClick={() => downloadQRCode(
//                           purchasedTickets[currentTicketIndex].qrCode,
//                           purchasedTickets[currentTicketIndex].ticketId,
//                           purchasedTickets[currentTicketIndex].ticketType
//                         )}
//                         size="sm"
//                         variant="outline"
//                         className="mx-auto flex"
//                       >
//                         <Download className="h-4 w-4 mr-2" />
//                         Download
//                       </Button>
//                     </div>
//                   </div>
//                 ) : (
//                   <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
//                     <p className="text-sm text-yellow-700">QR Code not available</p>
//                   </div>
//                 )}
//               </div>
              
//               {purchasedTickets.length > 1 && (
//                 <div className="flex justify-between items-center mt-4">
//                   <Button
//                     onClick={() => setCurrentTicketIndex(Math.max(0, currentTicketIndex - 1))}
//                     disabled={currentTicketIndex === 0}
//                     variant="outline"
//                     size="sm"
//                   >
//                     Previous
//                   </Button>
//                   <span className="text-sm text-gray-500">
//                     {currentTicketIndex + 1} / {purchasedTickets.length}
//                   </span>
//                   <Button
//                     onClick={() => setCurrentTicketIndex(Math.min(purchasedTickets.length - 1, currentTicketIndex + 1))}
//                     disabled={currentTicketIndex === purchasedTickets.length - 1}
//                     variant="outline"
//                     size="sm"
//                   >
//                     Next
//                   </Button>
//                 </div>
//               )}
//             </div>
//           )}
          
//           <div className="mt-6 flex justify-center gap-3">
//             <Button onClick={() => setShowTicketModal(false)} variant="outline">
//               Close
//             </Button>
//             <Button onClick={() => router.push("/")} className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white">
//               <HomeIcon className="h-4 w-4 mr-2" />
//               Home
//             </Button>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// }

// export default function PaymentSuccessPage() {
//   return (
//     <Suspense fallback={<div>Loading...</div>}>
//       <PaymentSuccessContent />
//     </Suspense>
//   )
// }


"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Download, HomeIcon } from "lucide-react"
import Image from "next/image"

interface Ticket {
  _id: string
  ticketId: string
  ticketType: string
  event: string
  user: string
  purchaseDate: string
  status: string
  qrCode: string
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [purchasedTickets, setPurchasedTickets] = useState<Ticket[]>([])
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0)
  const [hasProcessed, setHasProcessed] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const processingRef = useRef(false)

  const quantity = searchParams.get("quantity") || "1"
  const ticketType = searchParams.get("ticketType") || "Regular"
  const eventId = searchParams.get("id")
  const tx_ref = searchParams.get("tx_ref")

  const downloadQRCode = (qrCode: string, ticketId: string, ticketType: string) => {
    const link = document.createElement("a")
    link.href = qrCode
    link.download = `ticket-${ticketId}-${ticketType}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("QR code downloaded!")
  }

  useEffect(() => {
    if (
      eventId &&
      quantity &&
      ticketType &&
      !hasProcessed &&
      !processingRef.current
    ) {
      processingRef.current = true
      handleBuyClick().finally(() => {
        processingRef.current = false
      })
    }
  }, [eventId, quantity, ticketType, hasProcessed])

  const handleBuyClick = async () => {
    const storedAuth = localStorage.getItem("auth-storage")
    if (!storedAuth) {
      toast.error("Please sign in to continue")
      return
    }

    try {
      const parsedAuth = JSON.parse(storedAuth)
      const userId = parsedAuth.state?.user?._id
      const authToken = parsedAuth.state?.token

      if (!userId || !authToken) {
        toast.error("Authentication required")
        return
      }

      setIsLoading(true)
      setHasError(false)

      const requestData = {
        userId,
        ticketType,
        quantity: Number(quantity) || 1,
        paymentReference: tx_ref || `SUCCESS-${Date.now()}`,
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/buy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(requestData),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || result.message || "Ticket purchase failed")
      }

      let tickets: Ticket[] = []
      if (result.tickets && Array.isArray(result.tickets)) {
        tickets = result.tickets
      } else if (result.data && Array.isArray(result.data)) {
        tickets = result.data
      } else if (result.status === "success" && result.tickets) {
        tickets = result.tickets
      }

      if (tickets.length > 0) {
        toast.success("Payment processed successfully!")
        setPurchasedTickets(tickets)
        setShowTicketModal(true)
        setHasProcessed(true)
      } else {
        throw new Error("No tickets received from server")
      }
    } catch (err: any) {
      console.error("Ticket purchase error:", err)
      setHasError(true)
      setErrorMessage(err.message || "Payment processing failed")
      toast.error(err.message || "Payment processing failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-indigo-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {hasProcessed ? "Payment Successful!" : "Processing Payment"}
            </h1>
            <p className="text-gray-600 mb-1">
              {hasProcessed
                ? "Your tickets are ready!"
                : "Please wait while we process your order..."}
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Order Summary
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#0D47A1] mb-1">
                  {quantity}
                </div>
                <div className="text-sm text-gray-600">Tickets</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {ticketType}
                </div>
                <div className="text-sm text-gray-600">Ticket Type</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div
                  className={`text-lg font-semibold mb-1 ${
                    hasProcessed ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  {hasProcessed ? "Complete" : "Processing"}
                </div>
                <div className="text-sm text-gray-600">Status</div>
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D47A1] mx-auto mb-4"></div>
              <p className="text-[#0D47A1] font-medium">
                Generating your tickets...
              </p>
            </div>
          )}

          {!isLoading && !hasError && hasProcessed && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Tickets Generated Successfully!
              </h3>
              <p className="text-gray-600 mb-4">
                Tickets: {purchasedTickets.length}
              </p>
              <Button
                onClick={() => setShowTicketModal(true)}
                className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
              >
                View Tickets
              </Button>
            </div>
          )}

          {hasError && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-red-600 mb-2">
                Payment Failed
              </h3>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={handleBuyClick}
                  className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
                >
                  Retry
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  className="bg-gray-600 hover:bg-gray-700 text-white"
                >
                  <HomeIcon className="h-4 w-4 mr-2" />
                  Return Home
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🎟 Your Tickets</DialogTitle>
            <DialogDescription>
              Show these QR codes at the venue for check-in.
            </DialogDescription>
          </DialogHeader>

          {purchasedTickets.length > 0 && (
            <div className="mt-4">
              <div className="border p-4 rounded-lg bg-white shadow-sm text-center">
                <p className="text-sm mb-2 font-medium">
                  Ticket #{currentTicketIndex + 1} of {purchasedTickets.length}
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  ID: {purchasedTickets[currentTicketIndex]?.ticketId}
                </p>

                {purchasedTickets[currentTicketIndex]?.qrCode ? (
                  <div className="mb-4">
                    <div className="bg-white p-4 rounded-lg border inline-block">
                      <Image
                        src={purchasedTickets[currentTicketIndex].qrCode}
                        alt="QR Code"
                        width={200}
                        height={200}
                        className="mx-auto"
                      />
                    </div>
                    <div className="mt-3">
                      <Button
                        onClick={() =>
                          downloadQRCode(
                            purchasedTickets[currentTicketIndex].qrCode,
                            purchasedTickets[currentTicketIndex].ticketId,
                            purchasedTickets[currentTicketIndex].ticketType
                          )
                        }
                        size="sm"
                        variant="outline"
                        className="mx-auto flex"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-700">
                      QR Code not available
                    </p>
                  </div>
                )}
              </div>

              {purchasedTickets.length > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <Button
                    onClick={() =>
                      setCurrentTicketIndex(
                        Math.max(0, currentTicketIndex - 1)
                      )
                    }
                    disabled={currentTicketIndex === 0}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    {currentTicketIndex + 1} / {purchasedTickets.length}
                  </span>
                  <Button
                    onClick={() =>
                      setCurrentTicketIndex(
                        Math.min(
                          purchasedTickets.length - 1,
                          currentTicketIndex + 1
                        )
                      )
                    }
                    disabled={currentTicketIndex === purchasedTickets.length - 1}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => setShowTicketModal(false)} variant="outline">
              Close
            </Button>
            <Button
              onClick={() => router.push("/")}
              className="bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
            >
              <HomeIcon className="h-4 w-4 mr-2" />
              Home
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
