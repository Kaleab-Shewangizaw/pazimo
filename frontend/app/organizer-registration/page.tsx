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
import Navbar from "@/components/header/Navbar"
import Footer from "@/components/footer/footer"

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
  const router = useRouter();
  useEffect(() => {
    // Check if user is logged in as organizer
    if (typeof window !== 'undefined') {
      const userRole = localStorage.getItem('userRole');
      if (userRole === 'organizer') {
        router.replace('/organizer/dashboard');
      }
    }
  }, [router]);
  // ...existing registration page code...
}
