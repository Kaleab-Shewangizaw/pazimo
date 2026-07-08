"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Shield, Lock, Mail } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useAdminAuthStore } from "@/store/adminAuthStore"

export default function AdminLoginPage() {
  const router = useRouter()
  const { login } = useAdminAuthStore()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsSubmitting(true)
    try {
      await login(formData)
      toast.success('Logged in successfully!')
      router.push('/admin')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/logo.png" alt="Pazimo" className="w-32 dark:hidden md:w-40 h-auto" />
          <img src="/logo2.png" alt="Pazimo" className="w-32 hidden dark:block md:w-40 h-auto" />
        </div>

        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        
        </div>

        {/* Admin Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6 mt-8" noValidate>
          <div>
            <label htmlFor="email" className="block dark:text-gray-300 text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Input 
                id="email" 
                name="email" 
                type="email" 
                autoComplete="email" 
                required 
                className="h-12 pl-10"
                value={formData.email}
                onChange={handleChange}
                placeholder="email"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block dark:text-gray-300 text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 pl-10"
                value={formData.password}
                onChange={handleChange}
                placeholder="password"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 h-12"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in '}
          </Button>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Return to{" "}
            <Link href="/sign-in" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
              User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
