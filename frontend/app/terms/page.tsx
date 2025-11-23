"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, Calendar, Shield, FileText } from "lucide-react"
import { useRouter } from "next/navigation"

export default function TermsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#0D47A1] hover:bg-blue-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0D47A1] rounded-full mb-6">
            <FileText className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Organizer Terms & Conditions</h1>
          <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
            <Calendar className="h-4 w-4" />
            <span className="text-lg">Effective Date: July 30, 2025</span>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            These terms govern your use of Pazimo as an Event Organizer. Please read them carefully before creating and
            managing events on our platform.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Introduction */}
          <div className="bg-gradient-to-r from-[#0D47A1] to-blue-600 px-8 py-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6" />
              <h2 className="text-2xl font-semibold">Agreement Overview</h2>
            </div>
            <p className="text-blue-100 leading-relaxed text-lg">
              By registering as an Organizer on Pazimo, you agree to be bound by these Terms, our Privacy Policy, and
              any other applicable policies provided by Pazimo.
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="prose prose-lg max-w-none">
              {/* Section 1 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Eligibility</h2>
                </div>
                <div className="ml-11">
                  <p className="text-gray-700 leading-relaxed">
                    You must be at least 18 years old and legally able to enter into binding contracts in Ethiopia to
                    create and manage events on Pazimo.
                  </p>
                </div>
              </section>

              {/* Section 2 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Organizer Responsibilities</h2>
                </div>
                <div className="ml-11">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        You are responsible for providing accurate, complete, and up-to-date event information,
                        including event title, venue, time, pricing, and any restrictions.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        You must ensure that all events comply with applicable laws and do not violate the rights of
                        third parties.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        You are solely responsible for fulfilling all obligations related to your event, including
                        ticket delivery, customer support, and event execution.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        You agree not to list events that are false, misleading, illegal, or harmful.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Ticket Sales and Payouts</h2>
                </div>
                <div className="ml-11">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Tickets for your events will be sold through the Pazimo platform.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Pazimo will collect and process all payments on your behalf.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Organizer payouts will be made according to the agreed-upon schedule, typically after the event,
                        minus Pazimo's commission and applicable fees.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Pazimo reserves the right to withhold payouts in the case of disputes, chargebacks, or suspected
                        fraud.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Fees and Commission</h2>
                </div>
                <div className="ml-11">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Pazimo charges a service fee or commission on each ticket sold. The rate will be communicated to
                        you during event setup.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        You are responsible for any applicable taxes associated with your event income.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    5
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Cancellations and Refunds</h2>
                </div>
                <div className="ml-11">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Organizers must notify Pazimo and ticket buyers immediately if an event is canceled or
                        rescheduled.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Pazimo reserves the right to issue refunds to ticket buyers and deduct the amount from your
                        payout if the event is canceled or if buyers are entitled to refunds under applicable consumer
                        protection laws.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    6
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Prohibited Events</h2>
                </div>
                <div className="ml-11">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-800 font-medium mb-3">You may not use Pazimo to host or promote:</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">Illegal activities or gatherings.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">
                        Events that promote hate speech, discrimination, or violence.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">Fake, misleading, or scam-related events.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    7
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Limitation of Liability</h2>
                </div>
                <div className="ml-11">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 leading-relaxed">
                      Pazimo is a facilitator and is not responsible for the actual performance or quality of any event.
                      Organizers are solely liable for all aspects of their events, including safety and compliance with
                      laws.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 8 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    8
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Account Termination</h2>
                </div>
                <div className="ml-11">
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Pazimo may suspend or terminate your organizer account at any time if you:
                  </p>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">Violate these Terms;</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">Engage in fraudulent or unethical behavior;</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-2 h-2 bg-[#0D47A1] rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-gray-700 leading-relaxed">Harm the reputation of Pazimo or other users.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 9 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    9
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Changes to Terms</h2>
                </div>
                <div className="ml-11">
                  <p className="text-gray-700 leading-relaxed">
                    We may update these Terms occasionally. Organizers will be notified of significant changes.
                    Continued use of Pazimo after updates means you accept the revised Terms.
                  </p>
                </div>
              </section>

              {/* Section 10 */}
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-[#0D47A1] text-white rounded-full flex items-center justify-center text-sm font-bold">
                    10
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 m-0">Governing Law</h2>
                </div>
                <div className="ml-11">
                  <p className="text-gray-700 leading-relaxed">
                    These Terms are governed by the laws of Ethiopia. Any disputes shall be resolved through
                    negotiation, or if necessary, in the appropriate courts in Addis Ababa.
                  </p>
                </div>
              </section>
            </div>
          </div>

          {/* Contact Section */}
          <div className="bg-gray-50 px-8 py-8 border-t border-gray-200">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Help?</h2>
              <p className="text-gray-600 mb-6">
                For any questions about these terms or our services, please don't hesitate to contact us.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <div className="flex items-center gap-2 text-[#0D47A1]">
                  <Mail className="h-5 w-5" />
                  <a href="mailto:support@pazimo.com" className="font-medium hover:underline">
                    support@pazimo.com
                  </a>
                </div>
                <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
                <div className="flex items-center gap-2 text-[#0D47A1]">
                  <Phone className="h-5 w-5" />
                  <a href="tel:+251991051844" className="font-medium hover:underline">
                    +251 991 051 844
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
       
      </div>
    </div>
  )
}
