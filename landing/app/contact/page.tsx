"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Mail, MapPin, Send, MessageSquare, Clock, Users } from "lucide-react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { toast } from "sonner"

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    to: "support@pazimo.com",
    message: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in your name, email and message.")
      return
    }

    try {
      setIsSubmitting(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, from: form.email }),
      })
      if (!res.ok) throw new Error("Failed to send message")
      toast.success("Message sent. We'll get back to you soon.")
      setForm({ name: "", email: "", subject: "", to: "support@pazimo.com", message: "" })
      setSubmitted(true)
    } catch (err) {
      toast.error("Could not send your message. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
            <MessageSquare className="w-7 h-7 text-blue-700" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Contact Us</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">We'd love to hear from you. Send us a message and we'll respond promptly.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className={submitted ? "p-4" : "p-6"}>
                {submitted ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">Thanks! Your message has been sent.</h2>
                      <p className="text-sm text-gray-600">We’ll get back to you soon.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                      Send another
                    </Button>
                  </div>
                ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Name
                      </label>
                      <Input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </label>
                      <Input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Subject (optional)
                    </label>
                    <Input name="subject" value={form.subject} onChange={handleChange} placeholder="How can we help?" className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">To</label>
                    <Select value={form.to} onValueChange={(val) => setForm((prev) => ({ ...prev, to: val }))}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Choose team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="support@pazimo.com">General Support (support@pazimo.com)</SelectItem>
                        <SelectItem value="finance@pazimo.com">Finance (finance@pazimo.com)</SelectItem>
                        <SelectItem value="info@pazimo.com">Information (info@pazimo.com)</SelectItem>
                        <SelectItem value="organizers@pazimo.com">Organizers (organizers@pazimo.com)</SelectItem>
                        <SelectItem value="admin@pazimo.com">Administration (admin@pazimo.com)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Message</label>
                    <Textarea name="message" value={form.message} onChange={handleChange} placeholder="Write your message here..." className="min-h-24" />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={isSubmitting}
                    
                    
                    className="h-10 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-200 transform hover:scale-105"

                    >
                      {isSubmitting ? 'Sending...' : (<><Send className="w-4 h-4 mr-2"/>Send Message</>)}
                    </Button>
                  </div>
                </form>
















                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-green-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Our Location</h3>
                  </div>
                  <p className="text-gray-700 font-medium">Nifas Silk Lafto, Addis Ababa</p>
                  <p className="text-sm text-gray-500 mt-1">Ethiopia, East Africa</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Response Time</h3>
                  </div>
                  <p className="text-gray-700 font-medium">Within 24 hours</p>
                  <p className="text-sm text-gray-500 mt-1">Monday - Friday</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-700" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Support Emails</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div><a href="mailto:support@pazimo.com" className="text-blue-700 hover:underline">support@pazimo.com</a> <span className="text-gray-500">– General Support</span></div>
                  <div><a href="mailto:finance@pazimo.com" className="text-blue-700 hover:underline">finance@pazimo.com</a> <span className="text-gray-500">– Finance</span></div>
                  <div><a href="mailto:info@pazimo.com" className="text-blue-700 hover:underline">info@pazimo.com</a> <span className="text-gray-500">– Information</span></div>
                  <div><a href="mailto:organizers@pazimo.com" className="text-blue-700 hover:underline">organizers@pazimo.com</a> <span className="text-gray-500">– Organizers</span></div>
                  <div><a href="mailto:admin@pazimo.com" className="text-blue-700 hover:underline">admin@pazimo.com</a> <span className="text-gray-500">– Administration</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


