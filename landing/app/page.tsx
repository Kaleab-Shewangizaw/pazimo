"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  ChevronRight,
  CreditCard,
  Sparkles,
  Shield,
  Zap,
  Users,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Play,
  Menu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer"
import Header from "@/components/Header"
import Footer from "@/components/Footer"


const steps = [
  "Basic Information",
  "Event Registration",
  "Event Details",
  "Additional Information",
  "Terms & Agreement",
]

interface OrganizerFormData {
  organizerName: string
  contactPerson: string
  phoneNumber: string
  email: string
  password: string
  eventName: string
  eventType: string
  eventDescription: string
  eventDateTime: string
  eventLocation: string
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
  fullName: string
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
  eventKindOther: string
  hasOrganizedBefore: string
  eventKinds: string[]
  sampleEventName: string
  estimatedAudience: string
  eventFrequency: string[]
  agreeTerms: boolean
  agreeFee: boolean
  digitalSignature: boolean
}

function MobileMenu() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <button
          className="md:hidden p-2 rounded-md text-gray-700 hover:text-[#115db1] focus:outline-none focus:ring-2 focus:ring-[#115db1]"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="w-64 max-w-xs ml-auto rounded-l-xl p-0">
        <DrawerHeader>
          <div className="w-full flex justify-center items-center py-4">
            <img src="/logo.png" alt="Pazimo" className="w-28 mx-auto" />
          </div>
        </DrawerHeader>
        <nav className="flex flex-col gap-4 px-6 py-4">
          <Link
            href="http://pazimo.com/"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
          >
            Events
          </Link>
          <a
            href="#pricing"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >
            Pricing
          </a>
          <a
            href="#support"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
            onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}
          >
            Support
          </a>
        </nav>
        <DrawerClose asChild>
          <button className="mx-6 mt-4 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
            Close
          </button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  )
}

export default function OrganizerHome() {
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<OrganizerFormData>({
    organizerName: "",
    contactPerson: "",
    phoneNumber: "",
    email: "",
    password: "",
    eventName: "",
    eventType: "",
    eventDescription: "",
    eventDateTime: "",
    eventLocation: "",
    expectedAttendees: "",
    ticketTypes: {
      regular: false,
      vip: false,
      vvip: false,
      earlyBird: false,
      bundle: false,
    },
    ageRestriction: "",
    promoCode: "",
    offerPromo: false,
    marketingSupport: false,
    frontPageAd: false,
    onsiteSupport: false,
    fullName: "",
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
    eventKindOther: "",
    hasOrganizedBefore: "",
    eventKinds: [],
    sampleEventName: "",
    estimatedAudience: "",
    eventFrequency: [],
    agreeTerms: false,
    agreeFee: false,
    digitalSignature: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const organizerTypes = ["Individual", "Event Company", "NGO", "University Club", "Other"]

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

  const handleStepClick = (step: number) => {
    setActiveStep(step)
  }

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.replace('#', '')
      const el = document.getElementById(id)
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" })
        }, 100) // slight delay to ensure DOM is ready
      }
    }
  }, [])

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-white/10 backdrop-blur-sm px-4 sm:px-6 md:px-8 lg:px-20 py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 lg:mb-12">
            <div className="inline-flex items-center px-3 sm:px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium mb-4 sm:mb-6">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Solution For Event Organizers
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
              Sell Tickets to Your Events <span className="text-[#115db1]">Hassle Free.</span>
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
              Reach Thousands of Attendees & Grow Your Events with Pazimo Ticketing Platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button
                onClick={() => router.push("/organizer-registration")}
                className="w-full sm:w-auto bg-[#115db1] hover:bg-[#0d4a8f] px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-lg font-medium transition-all duration-200"
              >
                <Sparkles className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                Get Started
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg rounded-lg font-medium border-gray-300 text-gray-700 hover:border-[#115db1] hover:text-[#115db1] transition-all duration-200 bg-transparent"
              >
                <Play className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
                Learn More
              </Button>
            </div>
          </div>
          <div className="flex justify-center px-4">
            <div className="relative max-w-4xl w-full">
              <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl opacity-10 transform rotate-1" />
              <Image
                src="/images/pazimo.png"
                alt="Event organizer banner"
                width={800}
                height={500}
                className="relative w-full h-auto rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Pazimo */}
      <section id="about" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
              Why Choose <span className="text-[#115db1]">Pazimo?</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              The smart choice for Event Organizers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-4 sm:p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_clock.png" alt="Clock" width={32} height={32} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Easy Application Process</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Submit basic details, get verified fast, and access our secure dashboard instantly.
                </p>
              </CardContent>
            </Card>
            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-4 sm:p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_chart.png" alt="Chart" width={32} height={32} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Maximum Exposure</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Pazimo boosts your event with maximum exposure reach more attendees, sell more tickets, and grow your
                  audience effortlessly.
                </p>
              </CardContent>
            </Card>
            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-4 sm:p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_lock.png" alt="Lock" width={32} height={32} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Secure & Reliable</h3>
                <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                  Sell with zero stress. Pazimo's fraud-proof system guarantees secure transactions & 99.9% uptime.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How to Apply */}
      <section id="events" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-16">
          <div className="flex-1 order-2 lg:order-1">
            <div className="relative">
              <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl opacity-10 transform -rotate-6" />
              <Image
                src="/images/organizer_illustration1.png"
                alt="How to apply illustration"
                width={500}
                height={400}
                className="relative w-full h-auto rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 sm:space-y-8 order-1 lg:order-2">
            <div className="space-y-4 sm:space-y-6 text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                How to Apply as an <span className="text-[#115db1]">Event Organizer</span>
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic
                details, verify your account in minutes, and get instant access to your secure dashboard. Upload your
                event info, set up tickets, and connect your preferred payment method all in just a few clicks.
              </p>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-1.5 sm:p-2 flex-shrink-0">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Automated approval process</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">No long waits, start selling tickets right away</p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-1.5 sm:p-2 flex-shrink-0">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">24/7 support team</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">Ready to help if you need assistance</p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-1.5 sm:p-2 flex-shrink-0">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Fast, secure, and hassle-free</h4>
                  <p className="text-gray-600 text-xs sm:text-sm">From sign-up to your first sale</p>
                </div>
              </div>
            </div>
            <div className="text-center lg:text-left">
              <Button
                onClick={() => router.push("/organizer-registration")}
                className="w-full sm:w-auto bg-[#115db1] hover:bg-[#0d4a8f] px-6 sm:px-8 py-3 text-base sm:text-lg rounded-lg font-medium transition-all duration-200"
              >
                Register Now
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="bg-[#115db1] text-white py-12 sm:py-16 lg:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/5" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Making Moves, Breaking Records</h2>
            <p className="text-base sm:text-xl text-green-100 max-w-2xl mx-auto">
              We reached here with our hard work and dedication
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon1.png"
                  alt="Members"
                  width={48}
                  height={48}
                  className="mx-auto mb-2 sm:mb-4 w-8 h-8 sm:w-12 sm:h-12"
                />
                <h3 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2">1000+</h3>
                <p className="text-green-100 text-xs sm:text-sm lg:text-base">Members</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon2.png"
                  alt="Tickets"
                  width={48}
                  height={48}
                  className="mx-auto mb-2 sm:mb-4 w-8 h-8 sm:w-12 sm:h-12"
                />
                <h3 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2">50+</h3>
                <p className="text-green-100 text-xs sm:text-sm lg:text-base">Sold Tickets</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon3.png"
                  alt="Organizers"
                  width={48}
                  height={48}
                  className="mx-auto mb-2 sm:mb-4 w-8 h-8 sm:w-12 sm:h-12"
                />
                <h3 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2">25</h3>
                <p className="text-green-100 text-xs sm:text-sm lg:text-base">Organizers</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <CreditCard className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto mb-2 sm:mb-4 text-white" />
                <h3 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-1 sm:mb-2">25,000+</h3>
                <p className="text-green-100 text-xs sm:text-sm lg:text-base">Transactions in ETB</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="support" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-8 sm:gap-12 lg:gap-16">
          <div className="flex-1 order-2 lg:order-1">
            <div className="relative">
              <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-2xl sm:blur-3xl opacity-10 transform rotate-6" />
              <Image
                src="/images/organizer_illustration2.png"
                alt="Security illustration"
                width={500}
                height={400}
                className="relative w-full h-auto rounded-xl sm:rounded-2xl shadow-xl sm:shadow-2xl"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6 sm:space-y-8 order-1 lg:order-2">
            <div className="space-y-4 sm:space-y-6 text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                <span className="text-[#115db1]">Secure Transactions,</span>
                <br />
                Smooth Experience
              </h2>
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
                At Pazimo, security is our top priority. We understand the importance of keeping your data and
                transactions safe, which is why we implement advanced encryption protocols, multi-layered
                authentication, and continuous monitoring to protect both organizers and attendees.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-[#115db1] mb-3 sm:mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Advanced Encryption</h4>
                <p className="text-gray-600 text-xs sm:text-sm">Bank-level security protocols</p>
              </div>
              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-[#115db1] mb-3 sm:mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Real-time Processing</h4>
                <p className="text-gray-600 text-xs sm:text-sm">Instant payment confirmation</p>
              </div>
              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#115db1] mb-3 sm:mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Multiple Payment Gateways</h4>
                <p className="text-gray-600 text-xs sm:text-sm">Flexible payment options</p>
              </div>
              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#115db1] mb-3 sm:mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">99.9% Uptime</h4>
                <p className="text-gray-600 text-xs sm:text-sm">Reliable service guarantee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
              How does it <span className="text-[#115db1]">work?</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-6 sm:mb-8 px-4">
              Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic details,
              verify your account in minutes, and get instant access to your secure dashboard.
            </p>
            <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shadow-lg border border-gray-100 text-sm sm:text-base lg:text-lg">
              <span className="font-semibold text-gray-900">Sign up</span>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 rotate-90 sm:rotate-0" />
              <span className="font-semibold text-gray-900">Pay how you want</span>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 rotate-90 sm:rotate-0" />
              <span className="font-semibold text-gray-900">QR entry</span>
              <span className="font-bold text-green-600">Done!</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="group text-center space-y-4 sm:space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <Image
                    src="/images/organizer_phone1.png"
                    alt="Sign up"
                    width={110}
                    height={200}
                    className="mx-auto w-16 h-auto sm:w-20 lg:w-28"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Sign up in seconds</h3>
                <p className="text-gray-600 text-sm sm:text-base">Just email & basic details.</p>
              </div>
            </div>
            <div className="group text-center space-y-4 sm:space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <Image
                    src="/images/organizer_phone2.png"
                    alt="Payment"
                    width={110}
                    height={200}
                    className="mx-auto w-16 h-auto sm:w-20 lg:w-28"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Attendees pay safely</h3>
                <p className="text-gray-600 text-sm sm:text-base">Via Telebirr, CBE, or more</p>
              </div>
            </div>
            <div className="group text-center space-y-4 sm:space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-2xl sm:rounded-3xl blur-xl sm:blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 mx-auto bg-[#115db1] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-white rounded-lg sm:rounded-xl grid grid-cols-4 gap-0.5 sm:gap-1 p-2 sm:p-3">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="bg-gray-900 rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Unique QR codes</h3>
                <p className="text-gray-600 text-sm sm:text-base">Sent instantly scan at entry for fast check-in</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commission */}
      <section id="pricing" className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-6">
              Transparent & Fair <span className="text-[#115db1]">Commission</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-4xl mx-auto px-4">
              Only 3% per ticket guaranteed. No hidden fees, no last-minute charges, no surprises. With Pazimo's
              industry-low flat rate, you keep more of your hard earned revenue while we handle payments, security, and
              support. What you see is what you pay always.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
              <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Image
                  src="/images/tick.png"
                  alt="Check"
                  width={24}
                  height={24}
                  className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6"
                />
                <div>
                  <span className="font-semibold text-gray-900 text-sm sm:text-base">Locked-in rate promise: </span>
                  <span className="text-gray-600 text-sm sm:text-base">
                    Your commission never increases, no matter how big your event grows.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Image
                  src="/images/tick.png"
                  alt="Check"
                  width={24}
                  height={24}
                  className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6"
                />
                <div>
                  <span className="font-semibold text-gray-900 text-sm sm:text-base">Compare and save: </span>
                  <span className="text-gray-600 text-sm sm:text-base">
                    Other platforms charge 7-10%—we keep it fair at just 3%, forever.
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-[#115db1] text-white p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-2xl order-1 lg:order-2">
              <h3 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center">Pricing Calculator</h3>
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center">
                  <div className="text-3xl sm:text-4xl font-bold mb-2">3%</div>
                  <div className="text-green-100 text-sm sm:text-base">Commission Rate</div>
                </div>
                <div className="space-y-3 sm:space-y-4">
  <div className="flex justify-between items-center text-sm sm:text-base">
    <span>Ticket Price:</span>
    <span className="font-semibold">50 ETB</span>
  </div>
  <div className="flex justify-between items-center text-sm sm:text-base">
    <span>Our Fee:</span>
    <span className="font-semibold">1.50 ETB</span>
  </div>
  <div className="border-t border-white/20 pt-3 sm:pt-4">
    <div className="flex justify-between items-center text-base sm:text-lg font-bold">
      <span>You Keep:</span>
      <span>48.50 ETB</span>
    </div>
  </div>
</div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Download */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 text-center bg-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              Let's <span className="text-[#115db1]">Grow Together!</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4">
              Download the Pazimo App and join thousands of organizers building unforgettable events—while keeping more
              of your profits.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
            <div className="group cursor-pointer">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105 border border-gray-100">
                <Image
                  src="/images/organizer_app-store.png"
                  alt="Download on App Store"
                  width={180}
                  height={60}
                  className="cursor-pointer hover:opacity-80 transition-opacity w-32 sm:w-40 lg:w-44 h-auto"
                />
              </div>
            </div>
            <div className="group cursor-pointer">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105 border border-gray-100">
                <Image
                  src="/images/organizer-playstore.png"
                  alt="Get it on Google Play"
                  width={180}
                  height={60}
                  className="cursor-pointer hover:opacity-80 transition-opacity w-32 sm:w-40 lg:w-44 h-auto"
                />
              </div>
            </div>
          </div>
          <div className="pt-6 sm:pt-8">
            <Button
              onClick={() => router.push("/organizer-registration")}
              className="w-full sm:w-auto bg-[#115db1] hover:bg-[#0d4a8f] px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg rounded-lg font-medium transition-all duration-200"
            >
              <Sparkles className="mr-2 w-4 h-4 sm:w-5 sm:h-5" />
              Start Your Journey Today
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
