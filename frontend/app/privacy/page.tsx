import { Shield, Lock, Eye, Users, FileText, Mail, Calendar, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
                <Shield className="h-8 w-8" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">Privacy Policy</h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">
              Your privacy is our priority. Learn how we protect and handle your personal information.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center text-sm text-blue-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Effective: July 19, 2025</span>
              </div>
              <span className="hidden sm:block">•</span>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Last Updated: July 19, 2025</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Introduction */}
        <Card className="mb-8 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6 sm:p-8">
            <p className="text-gray-700 text-lg leading-relaxed">
              Your privacy is important to us. This Privacy Policy explains how Pazimo collects, uses, and protects your
              personal information.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Information We Collect */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">1. Information We Collect</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-900">Account Data:</span>
                    <span className="text-gray-700 ml-2">Name, email, phone number, password.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <Lock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-900">Payment Info:</span>
                    <span className="text-gray-700 ml-2">
                      Billing details (processed securely by third-party providers).
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-gray-900">Usage Data:</span>
                    <span className="text-gray-700 ml-2">App usage behavior, event preferences, and interactions.</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">2. How We Use Your Information</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>To process ticket purchases and provide customer support.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>To notify you about upcoming events, promotions, or app updates.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>To improve user experience and platform performance.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Sharing of Data */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">3. Sharing of Data</h2>
              </div>
              <div className="mb-4">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  We do not sell your data
                </Badge>
              </div>
              <p className="text-gray-700 mb-4">Your information may only be shared:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>With event organizers (for attendees only).</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>With trusted third-party services (e.g., payment processors).</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>If required by law or legal process.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">4. Data Security</h2>
              </div>
              <p className="text-gray-700">
                We use encryption, secure servers, and other safeguards to protect your data.
              </p>
            </CardContent>
          </Card>

          {/* Cookies & Analytics */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Eye className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">5. Cookies & Analytics</h2>
              </div>
              <p className="text-gray-700">
                We may use cookies and analytics tools to understand how users interact with our platform.
              </p>
            </CardContent>
          </Card>

          {/* Your Rights */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Shield className="h-5 w-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">6. Your Rights</h2>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Access or update your personal information.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Request deletion of your account or data.</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Opt-out of marketing communications.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">7. Children's Privacy</h2>
              </div>
              <p className="text-gray-700">
                Our platform is not intended for children under 13. We do not knowingly collect data from minors.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Policy */}
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <FileText className="h-5 w-5 text-teal-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">8. Changes to this Policy</h2>
              </div>
              <p className="text-gray-700">
                We may update this Privacy Policy. When we do, we'll notify users via app or email.
              </p>
            </CardContent>
          </Card>

          {/* Contact Us */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Mail className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-semibold">Contact Us</h2>
              </div>
              <p className="text-blue-100">
                For questions or concerns, reach out to:{" "}
                <a
                  href="mailto:support@pazimo.com"
                  className="text-white underline hover:text-blue-200 transition-colors font-medium"
                >
                  support@pazimo.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
    