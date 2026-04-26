/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  Sparkles,
  Shield,
  Zap,
  Users,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  User,
  Calendar,
  Settings,
  FileText,
  Upload,
  Star,
  Award,
  Globe,
  Phone,
  Mail,
  Lock,
  MapPin,
  Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

const steps = [
  { label: "Profile", description: "Personal & Organization" },
  { label: "Business", description: "Legal & Banking" },
  { label: "Experience", description: "Event History" },
  { label: "Preferences", description: "Platform Setup" },
  { label: "Agreement", description: "Terms & Fees" },
]

const stepIcons = [User, Building2, Calendar, Settings, FileText]

interface OrganizerFormData {
  fullName: string
  email: string
  password: string
  phoneNumber: string
  nationalIdNumber: string
  organizationName: string
  organizerType: string
  organizerTypeOther: string
  socialLinks: string
  businessLicense: File | null
  tinNumber: string
  businessAddress: string
  bankAccountHolder: string
  bankName: string
  bankAccountNumber: string
  contactRole: string
  hasOrganizedBefore: string
  eventKinds: string[]
  eventKindOther: string
  sampleEventName: string
  estimatedAudience: string
  eventFrequency: string
  payoutMethod: string
  needSupport: string
  useQrScanner: string
  agreeTerms: boolean
  agreeFee: boolean
  digitalSignature: boolean
  expectedAttendees: string
  ticketTypes: {
    regular: boolean
    vip: boolean
    vvip: boolean
    earlyBird: boolean
    bundle: boolean
  }
  ageRestriction: string
  promoCode: string
  offerPromo: boolean
  marketingSupport: boolean
  frontPageAd: boolean
  onsiteSupport: boolean
}

export default function OrganizerRegistrationPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<OrganizerFormData>({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    nationalIdNumber: "",
    organizationName: "",
    organizerType: "",
    organizerTypeOther: "",
    socialLinks: "",
    businessLicense: null,
    tinNumber: "",
    businessAddress: "",
    bankAccountHolder: "",
    bankName: "",
    bankAccountNumber: "",
    contactRole: "",
    hasOrganizedBefore: "",
    eventKinds: [],
    eventKindOther: "",
    sampleEventName: "",
    estimatedAudience: "",
    eventFrequency: "",
    payoutMethod: "",
    needSupport: "",
    useQrScanner: "",
    agreeTerms: false,
    agreeFee: false,
    digitalSignature: false,
    expectedAttendees: "",
    ticketTypes: {
      regular: false,
      vip: false,
      vvip: false,
      earlyBird: false,
      bundle: false,
    },
    ageRestriction: "none",
    promoCode: "",
    offerPromo: false,
    marketingSupport: false,
    frontPageAd: false,
    onsiteSupport: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})

  // Auto-scroll to top on step change for better UX
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [activeStep])

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1)
    }
  }

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1)
    }
  }
  const organizerTypes = [
    { value: "Individual", icon: User },
    { value: "Event Company", icon: Building2 },
    { value: "NGO", icon: Users },
    { value: "University Club", icon: Award },
    { value: "Other", icon: Star },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // console.log("Submitting formData:", formData)
    // Validate required fields and show missing ones in a toast
    const missing: string[] = []
    const requireField = (value: string | boolean, label: string) => {
      if (typeof value === 'string') {
        if (!value || value.trim().length === 0) missing.push(label)
      } else if (!value) {
        missing.push(label)
      }
    }
    requireField(formData.fullName, 'Full Name')
    requireField(formData.phoneNumber, 'Phone Number')
    requireField(formData.nationalIdNumber, 'National ID Number')
    requireField(formData.email, 'Email')
    requireField(formData.password, 'Password')
    requireField(formData.organizationName, 'Organization/Brand Name')
    requireField(formData.organizerType, 'Organizer Type')
    if (formData.organizerType === 'Other') {
      requireField(formData.organizerTypeOther, 'Organizer Type (Other)')
    }
    requireField(formData.businessAddress, 'Business Address')
    requireField(formData.bankAccountHolder, 'Bank Account Holder')
    requireField(formData.bankName, 'Bank Name')
    requireField(formData.bankAccountNumber, 'Bank Account Number')
    requireField(formData.contactRole, "Primary Contact Person's Role")
    requireField(formData.agreeTerms, 'Agree to Terms and Conditions')
    requireField(formData.agreeFee, 'Agree to Service Fee')
    requireField(formData.digitalSignature, 'Confirm Information Accuracy')

    if (missing.length > 0) {
      toast.error(`Please complete the following fields: ${missing.join(', ')}`)
      return
    }
    setIsLoading(true)
    try {
      const form = new FormData()
      form.append("name", formData.fullName)
      form.append("email", formData.email)
      form.append("phone", formData.phoneNumber)
      form.append("nationalIdNumber", formData.nationalIdNumber)
      form.append("organization", formData.organizationName)
      form.append("password", formData.password || Math.random().toString(36).slice(-8))
      form.append("organizerType", formData.organizerType)
      form.append("organizerTypeOther", formData.organizerTypeOther)
      form.append("socialLinks", formData.socialLinks)
      form.append("tinNumber", formData.tinNumber)
      form.append("businessAddress", formData.businessAddress)
      form.append("bankAccountHolder", formData.bankAccountHolder)
      form.append("bankName", formData.bankName)
      form.append("bankAccountNumber", formData.bankAccountNumber)
      form.append("contactRole", formData.contactRole)
      form.append("hasOrganizedBefore", formData.hasOrganizedBefore)
      form.append("eventKinds", JSON.stringify(formData.eventKinds || []))
      form.append("eventKindOther", formData.eventKindOther)
      form.append("sampleEventName", formData.sampleEventName)
      form.append("estimatedAudience", formData.estimatedAudience)
      form.append("eventFrequency", formData.eventFrequency)
      form.append("payoutMethod", formData.payoutMethod)
      form.append("needSupport", formData.needSupport)
      form.append("useQrScanner", formData.useQrScanner)
      form.append("agreeTerms", String(formData.agreeTerms))
      form.append("agreeFee", String(formData.agreeFee))
      form.append("digitalSignature", String(formData.digitalSignature))
      form.append("expectedAttendees", formData.expectedAttendees)
      form.append(
        "eventDetails",
        JSON.stringify({
          expectedAttendees: Number(formData.expectedAttendees),
          ticketTypes: formData.ticketTypes,
          ageRestriction: formData.ageRestriction,
          promoCode: formData.promoCode,
          offerPromo: formData.offerPromo,
          marketingSupport: formData.marketingSupport,
          frontPageAd: formData.frontPageAd,
          onsiteSupport: formData.onsiteSupport,
        }),
      )

      if (formData.businessLicense) {
        form.append("businessLicense", formData.businessLicense)
      }

      form.append("additionalServices", JSON.stringify({}))

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL
      const response = await fetch(`${apiBaseUrl}/api/organizers/sign-up`, {
        method: "POST",
        body: form,
      })

      const data = await response.json()

      if (!response.ok) {
        const fieldLabels: { [key: string]: string } = {
          phoneNumber: "Phone Number",
          email: "Email",
          password: "Password",
          fullName: "Full Name",
          organization: "Organization",
        }

        if (data.errors && typeof data.errors === "object") {
          Object.entries(data.errors).forEach(([field, err]: [string, any]) => {
            const label = fieldLabels[field] || field
            if (err && err.message) {
              toast.error(`${label}: ${err.message}`)
            } else if (typeof err === "string") {
              toast.error(`${label}: ${err}`)
            } else {
              toast.error(`${label}: Validation error`)
            }
          })
        } else {
          toast.error(data.message || "Failed to register")
        }
        throw new Error(data.message || "Failed to register")
      }

      localStorage.setItem("token", data.token)
      localStorage.setItem("organizer", JSON.stringify(data.organizer))
      localStorage.setItem("userId", data.organizer._id)
      localStorage.setItem("userRole", "organizer")
      toast.success("Registration successful!")
      setRegistrationSuccess(true)

      setTimeout(() => {
        router.push("/")
      }, 2000)
    } catch (error) {
      console.error("Registration error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to register")
    } finally {
      setIsLoading(false)
    }
  }

  function renderStepContent() {
    switch (activeStep) {
      case 0:
        return (
          <div className="flex flex-col gap-10 p-8 lg:p-12">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Organizer Profile
              </h2>
              <p className="text-muted-foreground">
                Start with your basic information and organization details.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Personal Information
                  </label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Full Name</label>
                      <Input
                        placeholder="e.g. John Doe"
                        value={formData.fullName}
                        onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                        className="h-12 border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Phone Number</label>
                      <Input
                        placeholder="+251 ..."
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData((f) => ({ ...f, phoneNumber: e.target.value }))}
                        className="h-12 border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">National ID Number</label>
                      <Input
                        placeholder="Enter ID number"
                        value={formData.nationalIdNumber}
                        onChange={(e) => setFormData((f) => ({ ...f, nationalIdNumber: e.target.value }))}
                        className="h-12 border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Security
                  </label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Email Address</label>
                      <Input
                        placeholder="mail@example.com"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                        className="h-12 border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Password</label>
                      <div className="relative">
                        <Input
                          placeholder="••••••••"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                          className="h-12 border-border bg-surface/50 pr-12 transition-all focus:border-accent focus:ring-accent/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Organization Details
                  </label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Organization/Brand Name</label>
                      <Input
                        placeholder="e.g. Pazimo Events"
                        value={formData.organizationName}
                        onChange={(e) => setFormData((f) => ({ ...f, organizationName: e.target.value }))}
                        className="h-12 border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground">Type of Organizer</label>
                      <div className="grid grid-cols-1 gap-2">
                        {organizerTypes.map((type) => (
                          <label key={type.value} className="cursor-pointer">
                            <input
                              type="radio"
                              name="organizerType"
                              value={type.value}
                              checked={formData.organizerType === type.value}
                              onChange={() => setFormData((f) => ({ ...f, organizerType: type.value }))}
                              className="sr-only"
                            />
                            <div
                              className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                formData.organizerType === type.value
                                  ? "border-accent bg-accent/5 text-foreground shadow-sm"
                                  : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                              }`}
                            >
                              <type.icon className={`h-4 w-4 ${formData.organizerType === type.value ? 'text-accent' : ''}`} />
                              <span className="text-sm font-medium">{type.value}</span>
                              {formData.organizerType === type.value && <CheckCircle className="ml-auto h-4 w-4 text-accent" />}
                            </div>
                          </label>
                        ))}
                      </div>
                      {formData.organizerType === "Other" && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                          <Input
                            placeholder="Specify organizer type"
                            value={formData.organizerTypeOther}
                            onChange={(e) => setFormData((f) => ({ ...f, organizerTypeOther: e.target.value }))}
                            className="mt-2 h-12 border-border bg-surface/50"
                          />
                        </motion.div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Social Links</label>
                      <Textarea
                        placeholder="Instagram, Website, etc."
                        value={formData.socialLinks}
                        onChange={(e) => setFormData((f) => ({ ...f, socialLinks: e.target.value }))}
                        className="h-24 resize-none border-border bg-surface/50 transition-all focus:border-accent focus:ring-accent/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border pt-8">
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 px-8 font-bold shadow-accent-btn"
              >
                Continue to Business Details
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col gap-10 p-8 lg:p-12">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Business & Legal
              </h2>
              <p className="text-muted-foreground">
                Help us verify your business and set up secure payouts.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Verification Documents
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, businessLicense: e.target.files ? e.target.files[0] : null }))
                      }
                      className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                    />
                    <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface/30 transition-all hover:border-accent/40 hover:bg-accent/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Upload className="h-6 w-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">Upload Business License</p>
                        <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 10MB</p>
                      </div>
                    </div>
                    {formData.businessLicense && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-3 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3 text-accent"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">{(formData.businessLicense as any).name}</span>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">TIN Number (Optional)</label>
                    <Input
                      placeholder="Enter TIN number"
                      value={formData.tinNumber}
                      onChange={(e) => setFormData((f) => ({ ...f, tinNumber: e.target.value }))}
                      className="h-12 border-border bg-surface/50 focus:border-accent focus:ring-accent/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Business Address</label>
                    <Input
                      placeholder="Registered address"
                      value={formData.businessAddress}
                      onChange={(e) => setFormData((f) => ({ ...f, businessAddress: e.target.value }))}
                      className="h-12 border-border bg-surface/50 focus:border-accent focus:ring-accent/20"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4 rounded-2xl border border-border bg-surface/50 p-6">
                  <div className="flex items-center gap-3 border-b border-border pb-4">
                    <Banknote className="h-5 w-5 text-accent" />
                    <h3 className="font-display font-bold text-foreground text-lg">Payout Information</h3>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Bank Account Holder</label>
                      <Input
                        placeholder="Name on account"
                        value={formData.bankAccountHolder}
                        onChange={(e) => setFormData((f) => ({ ...f, bankAccountHolder: e.target.value }))}
                        className="border-border bg-background focus:border-accent"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Bank Name</label>
                        <Input
                          placeholder="e.g. CBE, Dashen"
                          value={formData.bankName}
                          onChange={(e) => setFormData((f) => ({ ...f, bankName: e.target.value }))}
                          className="border-border bg-background focus:border-accent"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Account Number</label>
                        <Input
                          placeholder="0000 0000 0000"
                          value={formData.bankAccountNumber}
                          onChange={(e) => setFormData((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                          className="border-border bg-background focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Primary Contact Person's Role</label>
                  <Input
                    placeholder="e.g. Manager, Founder"
                    value={formData.contactRole}
                    onChange={(e) => setFormData((f) => ({ ...f, contactRole: e.target.value }))}
                    className="h-12 border-border bg-surface/50 focus:border-accent focus:ring-accent/20"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="h-12 px-8 font-semibold border-border hover:bg-surface"
              >
                <ChevronLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 px-8 font-bold shadow-accent-btn"
              >
                Continue to Experience
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )

      case 2:
        const eventKindOptions = [
          { value: "Music/Concerts", icon: "🎵" },
          { value: "Festivals", icon: "🎪" },
          { value: "Nightlife/Clubbing", icon: "🌙" },
          { value: "Conferences/Seminars", icon: "🎤" },
          { value: "Training/Workshops", icon: "📚" },
          { value: "Other", icon: "⭐" },
        ]

        const audienceOptions = [
          { value: "<100", label: "Under 100", icon: "👥" },
          { value: "100–500", label: "100 - 500", icon: "👨‍👩‍👧‍👦" },
          { value: "500–1,000", label: "500 - 1,000", icon: "🏟️" },
          { value: "1,000+", label: "1,000+", icon: "🎪" },
        ]

        const frequencyOptions = [
          { value: "Weekly", icon: "📅" },
          { value: "Monthly", icon: "🗓️" },
          { value: "Occasionally", icon: "⏰" },
          { value: "First Time Organizer", icon: "🌟" },
        ]

        return (
          <div className="flex flex-col gap-10 p-8 lg:p-12">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Event Profile
              </h2>
              <p className="text-muted-foreground">
                Tell us about your event experience and what you organize.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Experience
                  </label>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground">Have you organized events before?</label>
                      <div className="flex gap-2">
                        {["Yes", "No"].map((option) => (
                          <label key={option} className="flex-1 cursor-pointer">
                            <input
                              type="radio"
                              name="hasOrganizedBefore"
                              value={option}
                              checked={formData.hasOrganizedBefore === option}
                              onChange={() => setFormData((f) => ({ ...f, hasOrganizedBefore: option }))}
                              className="sr-only"
                            />
                            <div
                              className={`rounded-xl border py-2.5 text-center text-sm font-medium transition-all ${
                                formData.hasOrganizedBefore === option
                                  ? "border-accent bg-accent/5 text-foreground shadow-sm"
                                  : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                              }`}
                            >
                              {option}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-semibold text-foreground italic">What kind of events do you organize?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {eventKindOptions.map((option) => (
                          <label key={option.value} className="cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.eventKinds.includes(option.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData((f) => ({ ...f, eventKinds: [...f.eventKinds, option.value] }))
                                } else {
                                  setFormData((f) => ({ ...f, eventKinds: f.eventKinds.filter((k) => k !== option.value) }))
                                }
                              }}
                              className="sr-only"
                            />
                            <div
                              className={`flex items-center gap-2 rounded-xl border p-2.5 transition-all ${
                                formData.eventKinds.includes(option.value)
                                  ? "border-accent bg-accent/5 text-foreground shadow-sm"
                                  : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                              }`}
                            >
                              <span className="text-lg">{option.icon}</span>
                              <span className="text-xs font-medium leading-tight">{option.value}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {formData.eventKinds.includes("Other") && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                          <Input
                            placeholder="Specify event types"
                            value={formData.eventKindOther}
                            onChange={(e) => setFormData((f) => ({ ...f, eventKindOther: e.target.value }))}
                            className="mt-2 h-10 border-border bg-surface/50 text-sm"
                          />
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground">Estimated Audience per Event</label>
                    <div className="grid grid-cols-2 gap-2">
                      {audienceOptions.map((option) => (
                        <label key={option.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name="estimatedAudience"
                            value={option.value}
                            checked={formData.estimatedAudience === option.value}
                            onChange={() => setFormData((f) => ({ ...f, estimatedAudience: option.value }))}
                            className="sr-only"
                          />
                          <div
                            className={`flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all ${
                              formData.estimatedAudience === option.value
                                ? "border-accent bg-accent/5 text-foreground shadow-sm"
                                : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                            }`}
                          >
                            <span className="text-xl mb-1">{option.icon}</span>
                            <span className="text-xs font-bold">{option.label}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-foreground">Event Frequency</label>
                    <div className="grid grid-cols-2 gap-2">
                      {frequencyOptions.map((option) => (
                        <label key={option.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name="eventFrequency"
                            value={option.value}
                            checked={formData.eventFrequency === option.value}
                            onChange={() => setFormData((f) => ({ ...f, eventFrequency: option.value }))}
                            className="sr-only"
                          />
                          <div
                            className={`flex items-center gap-2 rounded-xl border p-2.5 transition-all ${
                              formData.eventFrequency === option.value
                                ? "border-accent bg-accent/5 text-foreground shadow-sm"
                                : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                            }`}
                          >
                            <span className="text-lg">{option.icon}</span>
                            <span className="text-xs font-medium leading-tight">{option.value}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Upcoming Event Name (Optional)</label>
                    <Input
                      placeholder="e.g. Summer Music Fest"
                      value={formData.sampleEventName}
                      onChange={(e) => setFormData((f) => ({ ...f, sampleEventName: e.target.value }))}
                      className="h-10 border-border bg-surface/50 text-sm focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="h-12 px-8 font-semibold border-border hover:bg-surface"
              >
                <ChevronLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 px-8 font-bold shadow-accent-btn"
              >
                Continue to Preferences
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )

      case 3:
        const payoutOptions = [
          { value: "Bank Transfer", icon: "🏦" },
          { value: "Mobile Money", icon: "📱" },
          { value: "Both", icon: "💳" },
        ]

        return (
          <div className="flex flex-col gap-10 p-8 lg:p-12">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Platform Setup
              </h2>
              <p className="text-muted-foreground">
                Configure how you want to use Pazimo for your events.
              </p>
            </div>

            <div className="space-y-10">
              <div className="space-y-4">
                <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Payout Method
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {payoutOptions.map((option) => (
                    <label key={option.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="payoutMethod"
                        value={option.value}
                        checked={formData.payoutMethod === option.value}
                        onChange={() => setFormData((f) => ({ ...f, payoutMethod: option.value }))}
                        className="sr-only"
                      />
                      <div
                        className={`flex flex-col items-center justify-center rounded-2xl border p-6 transition-all ${
                          formData.payoutMethod === option.value
                            ? "border-accent bg-accent/5 text-foreground shadow-md"
                            : "border-border bg-surface/30 text-muted-foreground hover:border-accent/30"
                        }`}
                      >
                        <span className="text-3xl mb-2">{option.icon}</span>
                        <span className="text-sm font-bold text-center">{option.value}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface/30 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">Setup Support</h3>
                  </div>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Do you need Pazimo support to set up your first event page?
                  </p>
                  <div className="flex gap-2">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="needSupport"
                          value={option}
                          checked={formData.needSupport === option}
                          onChange={() => setFormData((f) => ({ ...f, needSupport: option }))}
                          className="sr-only"
                        />
                        <div
                          className={`rounded-xl border py-2 text-center text-sm font-medium transition-all ${
                            formData.needSupport === option
                              ? "border-accent bg-accent/5 text-foreground shadow-sm"
                              : "border-border bg-surface/50 text-muted-foreground hover:border-accent/30"
                          }`}
                        >
                          {option}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-surface/30 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-bold text-foreground">QR Scanner</h3>
                  </div>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Use Pazimo's QR code scanner app for ticket validation?
                  </p>
                  <div className="flex gap-2">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="flex-1 cursor-pointer">
                        <input
                          type="radio"
                          name="useQrScanner"
                          value={option}
                          checked={formData.useQrScanner === option}
                          onChange={() => setFormData((f) => ({ ...f, useQrScanner: option }))}
                          className="sr-only"
                        />
                        <div
                          className={`rounded-xl border py-2 text-center text-sm font-medium transition-all ${
                            formData.useQrScanner === option
                              ? "border-accent bg-accent/5 text-foreground shadow-sm"
                              : "border-border bg-surface/50 text-muted-foreground hover:border-accent/30"
                          }`}
                        >
                          {option}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="h-12 px-8 font-semibold border-border hover:bg-surface"
              >
                <ChevronLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="h-12 px-8 font-bold shadow-accent-btn"
              >
                Review & Agreement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="flex flex-col gap-10 p-8 lg:p-12">
            <div className="space-y-2">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
                Agreement
              </h2>
              <p className="text-muted-foreground">
                Review our terms and complete your registration.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { 
                  id: 'agreeTerms', 
                  title: 'Terms and Conditions', 
                  content: (
                    <>
                      I have read and agree to Pazimo's{' '}
                      <a href="/terms" target="_blank" className="text-accent underline hover:text-accent/80">
                        Organizer Terms and Conditions
                      </a>
                    </>
                  )
                },
                { 
                  id: 'agreeFee', 
                  title: 'Service Fee Agreement', 
                  content: 'I understand that Pazimo deducts a service fee per ticket sold to cover platform costs.' 
                },
                { 
                  id: 'digitalSignature', 
                  title: 'Information Accuracy', 
                  content: 'I confirm that all provided information is accurate and truthful.' 
                }
              ].map((item) => (
                <label key={item.id} className="flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-surface/30 p-5 transition-all hover:bg-accent/5 hover:border-accent/30">
                  <input
                    type="checkbox"
                    checked={(formData as any)[item.id]}
                    onChange={(e) => setFormData((f) => ({ ...f, [item.id]: e.target.checked }))}
                    className="mt-1 h-5 w-5 accent-accent"
                  />
                  <div>
                    <p className="font-display text-base font-bold text-foreground">{item.title}</p>
                    <div className="text-sm text-muted-foreground">{item.content}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="h-12 px-8 font-semibold border-border hover:bg-surface"
              >
                <ChevronLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.agreeTerms || !formData.agreeFee || !formData.digitalSignature}
                className="h-12 px-12 font-bold shadow-accent-btn disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Creating Account...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Complete Registration
                  </div>
                )}
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

      /*
      console.log({
        agreeTerms: formData.agreeTerms,
        agreeFee: formData.agreeFee,
        digitalSignature: formData.digitalSignature,
      })
      */

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Success Modal */}
      {registrationSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex w-full max-w-sm flex-col items-center rounded-3xl border border-border bg-background p-8 shadow-2xl"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-center font-display text-2xl font-bold text-foreground">Registration Successful!</h2>
            <p className="text-center text-muted-foreground">
              Welcome to Pazimo. You will be redirected to the homepage shortly.
            </p>
          </motion.div>
        </div>
      )}

      <main className="flex-1 pt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            {/* Header section moved inside the form for better focus */}
            <div className="mb-12 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 inline-flex items-center gap-2"
              >
                <span className="h-px w-8 bg-accent" />
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                  Join the Network
                </span>
                <span className="h-px w-8 bg-accent" />
              </motion.div>
              <h1 className="mb-4 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
                Become a <span className="text-gradient-gold">Pazimo Organizer</span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Follow our step-by-step process to set up your verified organizer profile and start creating unforgettable experiences.
              </p>
            </div>

            {/* Premium Stepper UI */}
            <div className="mb-12 overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
              <div className="flex flex-col md:flex-row md:items-stretch">
                {steps.map((step, index) => {
                  const IconComponent = stepIcons[index]
                  const isActive = index === activeStep
                  const isCompleted = index < activeStep
                  return (
                    <div 
                      key={step.label} 
                      className={`relative flex flex-1 flex-col p-6 transition-colors duration-300 ${isActive ? 'bg-background' : ''}`}
                    >
                      <div className="relative z-10 flex items-center gap-4">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                            isCompleted
                              ? "bg-accent text-accent-foreground"
                              : isActive
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <IconComponent className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                            Step 0{index + 1}
                          </span>
                          <span className={`font-display text-sm font-bold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </span>
                        </div>
                      </div>
                      
                      {/* Desktop arrow/connector */}
                      {index < steps.length - 1 && (
                        <div className="absolute right-[-1px] top-1/2 hidden h-10 w-[1px] -translate-y-1/2 bg-border md:block" />
                      )}
                      
                      {/* Active indicator line */}
                      {isActive && (
                        <motion.div 
                          layoutId="stepIndicator"
                          className="absolute bottom-0 left-0 h-1 w-full bg-accent" 
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Form Container */}
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[2rem] border border-border bg-background shadow-2xl"
            >
              <form onSubmit={handleSubmit} className="p-0">
                {renderStepContent()}
              </form>
            </motion.div>

            {/* Helper Info */}
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <span>Verified Partners Only</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                <span>Quick Setup Process</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

