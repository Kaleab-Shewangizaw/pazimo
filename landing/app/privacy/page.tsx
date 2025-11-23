export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-center">Privacy Policy</h1>
          <p className="text-center text-blue-100 mt-2">Effective: July 19, 2025 • Last Updated: July 19, 2025</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <section className="bg-white/90 rounded-xl shadow p-6">
          <p className="text-gray-700 text-lg">Your privacy is important to us. This Privacy Policy explains how Pazimo collects, uses, and protects your personal information.</p>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li><span className="font-medium">Account Data:</span> Name, email, phone number, password.</li>
            <li><span className="font-medium">Payment Info:</span> Billing details (processed securely by third-party providers).</li>
            <li><span className="font-medium">Usage Data:</span> App usage behavior, event preferences, and interactions.</li>
          </ul>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>To process ticket purchases and provide customer support.</li>
            <li>To notify you about upcoming events, promotions, or app updates.</li>
            <li>To improve user experience and platform performance.</li>
          </ul>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">3. Sharing of Data</h2>
          <p className="text-gray-700 mb-2">We do not sell your data. Your information may only be shared:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>With event organizers (for attendees only).</li>
            <li>With trusted third-party services (e.g., payment processors).</li>
            <li>If required by law or legal process.</li>
          </ul>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
          <p className="text-gray-700">We use encryption, secure servers, and other safeguards to protect your data.</p>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">5. Cookies & Analytics</h2>
          <p className="text-gray-700">We may use cookies and analytics tools to understand how users interact with our platform.</p>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>Access or update your personal information.</li>
            <li>Request deletion of your account or data.</li>
            <li>Opt-out of marketing communications.</li>
          </ul>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">7. Children’s Privacy</h2>
          <p className="text-gray-700">Our platform is not intended for children under 13. We do not knowingly collect data from minors.</p>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">8. Changes to this Policy</h2>
          <p className="text-gray-700">We may update this Privacy Policy. When we do, we’ll notify users via app or email.</p>
        </section>

        <section className="bg-white/90 rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
          <p className="text-gray-700">For questions or concerns, reach out to: <a className="text-blue-700 underline" href="mailto:support@pazimo.com">support@pazimo.com</a></p>
        </section>
      </div>
    </div>
  )
}


