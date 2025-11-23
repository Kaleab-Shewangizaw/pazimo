"use client"

import type React from "react"

import { useState } from "react"
import { Send } from "lucide-react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface PaymentFormProps {
  amount?: string
  email?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  description?: string
  title?: string
  onSuccess?: (data: any) => void
  returnUrl?: string
}

export default function PaymentForm({
  amount = "",
  email = "",
  firstName = "",
  lastName = "",
  phoneNumber = "",
  description = "I love online payments",
  title = "Payment for my favourite merchant",
  onSuccess,
  returnUrl = window.location.href,
}: PaymentFormProps) {
  const [formData, setFormData] = useState({
    amount: amount,
    email: email,
    firstName: firstName,
    lastName: lastName,
    phoneNumber: phoneNumber,
  })
  const [qrCode, setQrCode] = useState<string>("")
  const [showQR, setShowQR] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const txRef = `tx-${Date.now()}` // Generate unique transaction reference

    const paymentData = {
      amount: formData.amount,
      currency: "ETB",
      email: formData.email,
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone_number: formData.phoneNumber,
      tx_ref: txRef,
      callback_url: "https://webhook.site/077164d6-29cb-40df-ba29-8a00e59a7e60",
      return_url: returnUrl,
      "customization[title]": title,
      "customization[description]": description,
      "meta[hide_receipt]": "false",
    }

    try {
      const myHeaders = new Headers()
      myHeaders.append("Authorization", "Bearer CHASECK-xxxxxxxxxxxxxxxx") // Replace with your actual Chapa secret key
      myHeaders.append("Content-Type", "application/json")

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(paymentData),
        redirect: "follow",
      }

      const response = await fetch("https://api.chapa.co/v1/transaction/initialize", requestOptions)

      const result = await response.json()

      if (result.status === "success") {
        // Generate QR code with payment details
        const qrData = JSON.stringify({
          txRef,
          amount: formData.amount,
          email: formData.email,
          name: `${formData.firstName} ${formData.lastName}`,
          timestamp: new Date().toISOString(),
        })

        const qrCodeDataUrl = await QRCode.toDataURL(qrData)
        setQrCode(qrCodeDataUrl)
        setShowQR(true)

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result)
        }

        // Redirect to Chapa checkout page after showing QR
        setTimeout(() => {
          window.location.href = result.data.checkout_url
        }, 3000)
      } else {
        console.error("Payment initialization failed:", result)
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Error:", error)
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800">Make Payment</CardTitle>
        <CardDescription>Complete your payment securely</CardDescription>
      </CardHeader>
      <CardContent>
        {showQR && qrCode ? (
          <div className="mb-6 text-center">
            <h3 className="text-lg font-semibold mb-2">Your Payment QR Code</h3>
            <img src={qrCode || "/placeholder.svg"} alt="Payment QR Code" className="mx-auto mb-2" />
            <p className="text-sm text-gray-600">Redirecting to payment page...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
                Amount (ETB)
              </Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="mt-1 block w-full"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                First Name
              </Label>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="mt-1 block w-full"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                Last Name
              </Label>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="mt-1 block w-full"
                required
                disabled={isSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                Phone Number
              </Label>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="mt-1 block w-full"
                required
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0D47A1] hover:bg-[#0D47A1]/90 text-white"
              disabled={isSubmitting}
            >
              <Send size={20} />
              Pay Now
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
