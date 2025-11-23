"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Apple, AppleIcon, Mail } from 'lucide-react'
import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/store/authStore"
import { toast } from "sonner"
import { IoLogoApple } from "react-icons/io"; // iOS-style Apple logo

function SignInContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  const [errors, setErrors] = useState({
    email: "",
    password: "",
  })

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const validateForm = () => {
    const newErrors = {
      email: "",
      password: "",
    }

    let isValid = true

    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
      isValid = false
    }

    // Validate password
    if (!formData.password) {
      newErrors.password = "Password is required"
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    setErrors(prev => ({
      ...prev,
      [name]: ""
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!validateForm()) {
      toast.error("Please fill in all required fields correctly")
      return
    }

    setIsSubmitting(true)
    try {
      await login({
        email: formData.email,
        password: formData.password
      })
      
      // Get the current user from the store
      const currentUser = useAuthStore.getState().user
      
      if (currentUser?.role === "admin") {
        toast.error("Admins must use the admin login page.");
        setIsSubmitting(false);
        return;
      }
      
      toast.success('Logged in successfully!')
      
      // If a next param is present, prioritize redirecting there (after role checks)
      const nextUrl = searchParams.get('next')

      // Redirect based on role or next param
      if (currentUser?.role === 'organizer') {
        router.push('/organizer')
      } else if (nextUrl) {
        try {
          const url = new URL(nextUrl, window.location.origin)
          // only allow same-origin redirects
          if (url.origin === window.location.origin) {
            router.push(url.pathname + url.search + url.hash)
          } else {
            router.push('/')
          }
        } catch {
          router.push('/')
        }
      } else {
        router.push('/')
      }
    } catch (error) {
      // console.error('Login error:', error)
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Don't render anything until after hydration
  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="logo.png" alt="" className="md:w-40 lg:-w-35" />
        </div>

        {/* Social Sign In */}
        <div className="space-y-4">
        {/* <Button 
  type="button" 
  variant="outline" 
  className="w-full bg-black text-white hover:bg-gray-800 border-0 h-12"
>
  <IoLogoApple className="mr-2 h-5 w-5" />
  Continue with iOS
</Button> */}
{/*           
          <Button 
            type="button" 
            variant="outline" 
            className="w-full border border-gray-300 h-12"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Continue with Google
          </Button> */}
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">SIGN IN</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-12"
              value={formData.email}
              onChange={handleChange}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-12"
              value={formData.password}
              onChange={handleChange}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          {/* Forgot Password link removed as per requirement */}

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 h-12"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </form>

        {/* Sign Up Link removed per requirements */}
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  )
}
