// import { FileText, MessageCircle, Phone } from "lucide-react"
// import { Card, CardContent } from "@/components/ui/card"

// export default function HelpPage() {
//   return (
//     <div className="p-6">
//       <h1 className="text-2xl font-bold mb-8">Help Center</h1>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         <Card>
//           <CardContent className="p-6">
//             <div className="flex flex-col items-center text-center">
//               <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
//                 <FileText className="h-6 w-6 text-blue-600" />
//               </div>
//               <h2 className="text-lg font-bold mb-2">Documentation</h2>
//               <p className="text-gray-500 mb-4">Browse our detailed documentation to learn how to use the platform.</p>
//               <a href="#" className="text-blue-600 font-medium hover:underline">
//                 View Documentation
//               </a>
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex flex-col items-center text-center">
//               <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
//                 <MessageCircle className="h-6 w-6 text-green-600" />
//               </div>
//               <h2 className="text-lg font-bold mb-2">Chat Support</h2>
//               <p className="text-gray-500 mb-4">Chat with our support team for immediate assistance.</p>
//               <a href="#" className="text-blue-600 font-medium hover:underline">
//                 Start Chat
//               </a>
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex flex-col items-center text-center">
//               <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
//                 <Phone className="h-6 w-6 text-purple-600" />
//               </div>
//               <h2 className="text-lg font-bold mb-2">Call Support</h2>
//               <p className="text-gray-500 mb-4">Call our support team during business hours.</p>
//               <a href="#" className="text-blue-600 font-medium hover:underline">
//                 0991051844
//               </a>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }


import { FileText, MessageCircle, Phone, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function HelpPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-8">Help Center</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold mb-2">Documentation</h2>
              <p className="text-gray-500 mb-4">Browse our detailed documentation to learn how to use the platform.</p>
              <a href="#" className="text-blue-600 font-medium hover:underline">
                View Documentation
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h2 className="text-lg font-bold mb-2">Chat Support</h2>
              <p className="text-gray-500 mb-4">Chat with our support team for immediate assistance.</p>
              <a href="#" className="text-blue-600 font-medium hover:underline">
                Start Chat
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-4">
                <Phone className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-lg font-bold mb-2">Call Support</h2>
              <p className="text-gray-500 mb-4">Call our support team during business hours.</p>
              <a href="tel:0991051844" className="text-blue-600 font-medium hover:underline">
                0991051844
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Support Section */}
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-6">Email Support</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium">General Support</h3>
                  <a href="mailto:support@pazimo.com" className="text-blue-600 text-sm hover:underline">
                    support@pazimo.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-green-600" />
                <div>
                  <h3 className="font-medium">Finance</h3>
                  <a href="mailto:finance@pazimo.com" className="text-blue-600 text-sm hover:underline">
                    finance@pazimo.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-purple-600" />
                <div>
                  <h3 className="font-medium">General Info</h3>
                  <a href="mailto:info@pazimo.com" className="text-blue-600 text-sm hover:underline">
                    info@pazimo.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-orange-600" />
                <div>
                  <h3 className="font-medium">Organizers</h3>
                  <a href="mailto:organizers@pazimo.com" className="text-blue-600 text-sm hover:underline">
                    organizers@pazimo.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-medium">Admin</h3>
                  <a href="mailto:admin@pazimo.com" className="text-blue-600 text-sm hover:underline">
                    admin@pazimo.com
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
