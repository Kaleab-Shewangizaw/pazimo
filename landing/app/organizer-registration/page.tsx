/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
"use client"

import type React from "react"
import { useState } from "react"
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
import Header from "@/components/Header"
import Footer from "@/components/Footer"

const steps = [
  "Organizer Information",
  "Business & Legal Details",
  "Event Profile",
  "Platform Preferences",
  "Terms & Agreement",
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
    { value: "Individual", icon: User, color: "bg-blue-50 text-blue-600 border-blue-200" },
    { value: "Event Company", icon: Building2, color: "bg-purple-50 text-purple-600 border-purple-200" },
    { value: "NGO", icon: Users, color: "bg-green-50 text-green-600 border-green-200" },
    { value: "University Club", icon: Award, color: "bg-orange-50 text-orange-600 border-orange-200" },
    { value: "Other", icon: Star, color: "bg-gray-50 text-gray-600 border-gray-200" },
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
          <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Tell Us About Yourself
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-md mx-auto px-4">
                Let's start with your basic information and organization details
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </label>
                  <Input
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </label>
                  <Input
                    placeholder="Enter your phone number"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, phoneNumber: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    National ID Number
                  </label>
                  <Input
                    placeholder="Enter your national ID number"
                    value={formData.nationalIdNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, nationalIdNumber: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <Input
                    placeholder="Enter your email address"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Create a secure password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                      className="h-12 sm:h-14 text-base pl-4 pr-14 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Organization/Brand Name
                  </label>
                  <Input
                    placeholder="Enter your organization name"
                    value={formData.organizationName}
                    onChange={(e) => setFormData((f) => ({ ...f, organizationName: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-gray-700">Type of Organizer</label>
                  <div className="grid grid-cols-1 gap-3">
                    {organizerTypes.map((type) => {
                      const IconComponent = type.icon
                      return (
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
                            className={`p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                              formData.organizerType === type.value
                                ? `${type.color} shadow-lg transform scale-105`
                                : "bg-white border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                              <span className="font-medium text-sm sm:text-base">{type.value}</span>
                            </div>
                          </div>
                          {type.value === "Other" && formData.organizerType === "Other" && (
                            <Input
                              placeholder="Please specify"
                              value={formData.organizerTypeOther}
                              onChange={(e) => setFormData((f) => ({ ...f, organizerTypeOther: e.target.value }))}
                              className="mt-3 h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                            />
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Social Media Links <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Textarea
                    placeholder="Facebook, Instagram, TikTok, Website, etc. (comma separated)"
                    value={formData.socialLinks}
                    onChange={(e) => setFormData((f) => ({ ...f, socialLinks: e.target.value }))}
                    className="h-24 sm:h-32 text-base border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 sm:pt-8">
              <Button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Business & Legal Details
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-md mx-auto px-4">
                Help us verify your business and set up secure payouts
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="space-y-4 sm:space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Business License{" "}
                    <span className="text-xs text-gray-400 font-normal">(optional but recommended)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, businessLicense: e.target.files ? e.target.files[0] : null }))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="h-24 sm:h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200">
                      <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                      <p className="text-xs sm:text-sm text-gray-600 text-center px-2">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-400">PDF, JPG, PNG up to 10MB</p>
                    </div>
                    {formData.businessLicense && "name" in formData.businessLicense && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {formData.businessLicense.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    TIN Number <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="Enter your TIN number"
                    value={formData.tinNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, tinNumber: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Business Address
                  </label>
                  <Input
                    placeholder="Enter your registered business address"
                    value={formData.businessAddress}
                    onChange={(e) => setFormData((f) => ({ ...f, businessAddress: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 sm:p-6 rounded-xl border border-blue-100">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    Banking Information
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <Input
                      placeholder="Bank Account Holder Name"
                      value={formData.bankAccountHolder}
                      onChange={(e) => setFormData((f) => ({ ...f, bankAccountHolder: e.target.value }))}
                      className="h-12 text-base pl-4 border-2 border-white focus:border-blue-500 rounded-lg bg-white"
                    />
                    <Input
                      placeholder="Bank Name"
                      value={formData.bankName}
                      onChange={(e) => setFormData((f) => ({ ...f, bankName: e.target.value }))}
                      className="h-12 text-base pl-4 border-2 border-white focus:border-blue-500 rounded-lg bg-white"
                    />
                    <Input
                      placeholder="Bank Account Number"
                      value={formData.bankAccountNumber}
                      onChange={(e) => setFormData((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                      className="h-12 text-base pl-4 border-2 border-white focus:border-blue-500 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Primary Contact Person's Role</label>
                  <Input
                    placeholder="e.g., Manager, Founder, Director"
                    value={formData.contactRole}
                    onChange={(e) => setFormData((f) => ({ ...f, contactRole: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 sm:pt-8">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        )

      case 2:
        const eventKindOptions = [
          { value: "Music/Concerts", icon: "🎵", color: "bg-pink-50 border-pink-200 text-pink-700" },
          { value: "Festivals", icon: "🎪", color: "bg-orange-50 border-orange-200 text-orange-700" },
          { value: "Nightlife/Clubbing", icon: "🌙", color: "bg-purple-50 border-purple-200 text-purple-700" },
          { value: "Conferences/Seminars", icon: "🎤", color: "bg-blue-50 border-blue-200 text-blue-700" },
          { value: "Training/Workshops", icon: "📚", color: "bg-green-50 border-green-200 text-green-700" },
          { value: "Other", icon: "⭐", color: "bg-gray-50 border-gray-200 text-gray-700" },
        ]

        const audienceOptions = [
          { value: "<100", label: "Under 100", icon: "👥" },
          { value: "100–500", label: "100 - 500", icon: "👨‍👩‍👧‍👦" },
          { value: "500–1,000", label: "500 - 1,000", icon: "🏟️" },
          { value: "1,000+", label: "1,000+", icon: "🎪" },
        ]

        const frequencyOptions = [
          { value: "Weekly", icon: "📅", color: "bg-blue-50 border-blue-200" },
          { value: "Monthly", icon: "🗓️", color: "bg-green-50 border-green-200" },
          { value: "Occasionally", icon: "⏰", color: "bg-yellow-50 border-yellow-200" },
          { value: "First Time Organizer", icon: "🌟", color: "bg-purple-50 border-purple-200" },
        ]

        return (
          <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Event Profile
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-md mx-auto px-4">
                Tell us about your event experience and what you organize
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-4">
                  <label className="text-base sm:text-lg font-semibold text-gray-800">
                    Have you organized events before?
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="hasOrganizedBefore"
                          value={option}
                          checked={formData.hasOrganizedBefore === option}
                          onChange={() => setFormData((f) => ({ ...f, hasOrganizedBefore: option }))}
                          className="sr-only"
                        />
                        <div
                          className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                            formData.hasOrganizedBefore === option
                              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-lg"
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <span className="font-semibold">{option}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base sm:text-lg font-semibold text-gray-800">
                    What kind of events do you organize?
                  </label>
                  <div className="grid grid-cols-1 gap-3">
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
                          className={`p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
                            formData.eventKinds.includes(option.value)
                              ? `${option.color} shadow-lg transform scale-105`
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl sm:text-2xl">{option.icon}</span>
                            <span className="font-medium text-sm sm:text-base">{option.value}</span>
                          </div>
                        </div>
                        {option.value === "Other" && formData.eventKinds.includes("Other") && (
                          <Input
                            placeholder="Please specify"
                            value={formData.eventKindOther}
                            onChange={(e) => setFormData((f) => ({ ...f, eventKindOther: e.target.value }))}
                            className="mt-3 h-12 border-2 border-gray-200 focus:border-blue-500 rounded-lg"
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Upcoming Event Name <span className="text-xs text-gray-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g., Summer Music Festival 2024"
                    value={formData.sampleEventName}
                    onChange={(e) => setFormData((f) => ({ ...f, sampleEventName: e.target.value }))}
                    className="h-12 sm:h-14 text-base pl-4 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all duration-200 hover:border-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-4">
                  <label className="text-base sm:text-lg font-semibold text-gray-800">Event Frequency</label>
                  <div className="grid grid-cols-1 gap-3">
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
                          className={`p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
                            formData.eventFrequency === option.value
                              ? `${option.color} shadow-lg transform scale-105`
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg sm:text-xl">{option.icon}</span>
                            <span className="font-medium text-sm sm:text-base">{option.value}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Estimated Audience per Event</label>
                  <div className="grid grid-cols-2 gap-3">
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
                          className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                            formData.estimatedAudience === option.value
                              ? "bg-green-50 border-green-500 text-green-700 shadow-lg"
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="text-xl sm:text-2xl mb-2">{option.icon}</div>
                          <div className="font-semibold text-xs sm:text-sm">{option.label}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 sm:pt-8">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        )

      case 3:
        const payoutOptions = [
          { value: "Bank Transfer", icon: "🏦", color: "bg-blue-50 border-blue-200" },
          { value: "Mobile Money (Telebirr, CBE Birr, etc.)", icon: "📱", color: "bg-green-50 border-green-200" },
          { value: "Both", icon: "💳", color: "bg-purple-50 border-purple-200" },
        ]

        return (
          <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Settings className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Platform Preferences
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-md mx-auto px-4">
                Configure how you want to use Pazimo for your events
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-10">
              <div className="space-y-4 sm:space-y-6">
                <label className="text-lg sm:text-xl font-semibold text-gray-800">Preferred Payout Method</label>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
                        className={`p-4 sm:p-6 rounded-xl border-2 transition-all duration-200 ${
                          formData.payoutMethod === option.value
                            ? `${option.color} shadow-lg transform scale-105`
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <span className="text-2xl sm:text-3xl">{option.icon}</span>
                          <span className="font-semibold text-base sm:text-lg">{option.value}</span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl border border-blue-100">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    Setup Support
                  </h3>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm">
                    Do you need Pazimo support to set up your first event page?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="needSupport"
                          value={option}
                          checked={formData.needSupport === option}
                          onChange={() => setFormData((f) => ({ ...f, needSupport: option }))}
                          className="sr-only"
                        />
                        <div
                          className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                            formData.needSupport === option
                              ? "bg-blue-100 border-blue-500 text-blue-700"
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <span className="font-semibold">{option}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 sm:p-6 rounded-xl border border-purple-100">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                    QR Scanner
                  </h3>
                  <p className="text-gray-600 mb-3 sm:mb-4 text-sm">
                    Use Pazimo's QR code scanner app for ticket validation?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {["Yes", "No"].map((option) => (
                      <label key={option} className="cursor-pointer flex-1">
                        <input
                          type="radio"
                          name="useQrScanner"
                          value={option}
                          checked={formData.useQrScanner === option}
                          onChange={() => setFormData((f) => ({ ...f, useQrScanner: option }))}
                          className="sr-only"
                        />
                        <div
                          className={`p-3 rounded-lg border-2 text-center transition-all duration-200 ${
                            formData.useQrScanner === option
                              ? "bg-purple-100 border-purple-500 text-purple-700"
                              : "bg-white border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <span className="font-semibold">{option}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 sm:pt-8">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Back
              </Button>
              <Button
                type="button"
                onClick={handleNext}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10 p-4 sm:p-6 lg:p-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Terms & Agreement
              </h2>
              <p className="text-gray-600 text-base sm:text-lg max-w-md mx-auto px-4">
                Please review and confirm to complete your registration
              </p>
            </div>

            <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
              <div className="space-y-4 sm:space-y-6">
                <label className="flex items-start gap-3 sm:gap-4 cursor-pointer p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData((f) => ({ ...f, agreeTerms: e.target.checked }))}
                    className="w-5 h-5 sm:w-6 sm:h-6 accent-blue-600 mt-1 flex-shrink-0"
                  />
                  <div>
                    <p className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Terms and Conditions</p>
                    <p className="text-gray-600 text-sm sm:text-base">
                      I have read and agree to Pazimo's{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        className="text-blue-600 hover:text-blue-700 underline font-medium"
                        rel="noreferrer"
                      >
                        Organizer Terms and Conditions
                      </a>
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 sm:gap-4 cursor-pointer p-4 sm:p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100 hover:shadow-md transition-all duration-200">
                  <input
                    type="checkbox"
                    checked={formData.agreeFee}
                    onChange={(e) => setFormData((f) => ({ ...f, agreeFee: e.target.checked }))}
                    className="w-5 h-5 sm:w-6 sm:h-6 accent-green-600 mt-1 flex-shrink-0"
                  />
                  <div>
                    <p className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Service Fee Agreement</p>
                    <p className="text-gray-600 text-sm sm:text-base">
                      I understand that Pazimo deducts a service fee per ticket sold to cover platform costs and
                      services.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 sm:gap-4 cursor-pointer p-4 sm:p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-all duration-200">
                  <input
                    type="checkbox"
                    checked={formData.digitalSignature}
                    onChange={(e) => setFormData((f) => ({ ...f, digitalSignature: e.target.checked }))}
                    className="w-5 h-5 sm:w-6 sm:h-6 accent-purple-600 mt-1 flex-shrink-0"
                  />
                  <div>
                    <p className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Information Accuracy</p>
                    <p className="text-gray-600 text-sm sm:text-base">
                      I confirm that all the information provided above is accurate and truthful.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 sm:pt-8">
              <Button
                variant="outline"
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 hover:bg-gray-50 transition-all duration-200 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.agreeTerms || !formData.agreeFee || !formData.digitalSignature}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 px-8 sm:px-12 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating Account...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    Complete Registration
                  </div>
                )}
              </Button>
            </div>

            {/* Error messages */}
            <div className="max-w-2xl mx-auto space-y-2">
              {isLoading && <div className="text-sm text-gray-500 text-center">Submitting, please wait...</div>}
              {!formData.agreeTerms && (
                <div className="text-sm text-red-500 text-center">You must agree to the Terms and Conditions.</div>
              )}
              {!formData.agreeFee && (
                <div className="text-sm text-red-500 text-center">You must agree to the Service Fee Agreement.</div>
              )}
              {!formData.digitalSignature && (
                <div className="text-sm text-red-500 text-center">You must confirm Information Accuracy.</div>
              )}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">

      {/* Success Modal */}
      {registrationSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col items-center max-w-sm w-full mx-4">
            <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-center">Registration Successful!</h2>
            <p className="text-gray-700 mb-2 text-center text-sm sm:text-base">
              You will be redirected to the homepage shortly.
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center py-6 sm:py-8 lg:py-12 px-4">
        <div className="w-full max-w-7xl">
          {/* Enhanced Stepper UI */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 sm:mb-8 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const IconComponent = stepIcons[index]
                const isActive = index === activeStep
                const isCompleted = index < activeStep
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div
                      className="flex flex-col items-center cursor-pointer group"
                      onClick={() => setActiveStep(index)}
                    >
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 mb-1 sm:mb-2 ${
                          isCompleted
                            ? "bg-green-500 text-white shadow-lg"
                            : isActive
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-110"
                              : "bg-gray-200 text-gray-500 group-hover:bg-gray-300"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                        ) : (
                          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                        )}
                      </div>
                      <div
                        className={`text-center transition-all duration-300 ${
                          isActive
                            ? "text-blue-600 font-semibold"
                            : isCompleted
                              ? "text-green-600 font-medium"
                              : "text-gray-500"
                        }`}
                      >
                        <div className="text-xs font-medium hidden md:block leading-tight">{step}</div>
                        <div className="text-xs text-gray-400 hidden lg:block">Step {index + 1}</div>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 sm:h-1 mx-2 sm:mx-4 rounded-full transition-all duration-500 ${
                          index < activeStep ? "bg-gradient-to-r from-green-400 to-blue-500" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Enhanced Form Container */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          >
            {renderStepContent()}
          </form>
        </div>
      </div>
   
    </div>
  )
}
