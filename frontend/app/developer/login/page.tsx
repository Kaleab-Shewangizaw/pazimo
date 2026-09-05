"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Terminal, Lock, Mail } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useDeveloperAuthStore } from "@/store/developerAuthStore"

export default function DeveloperLoginPage() {
  const router = useRouter()
  const { login } = useDeveloperAuthStore()
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
      router.push('/developer')
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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-950 dark:bg-black">
      <div className="w-full max-w-md space-y-8 bg-gray-900 dark:bg-gray-900 p-8 rounded-lg shadow-md border border-gray-800">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-emerald-950 rounded-full">
              <Terminal className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-lg font-medium text-gray-200">Developer Console</h1>
          <p className="text-sm text-gray-500 mt-1">Server monitoring access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-8" noValidate>
          <div>
            <label htmlFor="email" className="block text-gray-300 text-sm font-medium mb-1">
              Email
            </label>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-12 pl-10 bg-gray-800 border-gray-700 text-gray-100"
                value={formData.email}
                onChange={handleChange}
                placeholder="email"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-300 text-sm font-medium mb-1">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12 pl-10 bg-gray-800 border-gray-700 text-gray-100"
                value={formData.password}
                onChange={handleChange}
                placeholder="password"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-600 h-12"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Return to{" "}
            <Link href="/sign-in" className="font-medium text-emerald-400 hover:text-emerald-300">
              User Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
