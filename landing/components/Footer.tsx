// "use client"
// import React from "react"

// export default function Footer() {
//   return (
//     <footer className="bg-[#115db1] text-white py-12">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
//           <div>
//             <div className="text-2xl font-bold text-white mb-4">Pazimo</div>
//             <p className="text-white">
//               Connecting event organizers to the global market with powerful, easy-to-use tools.
//             </p>
//           </div>
//           <div>
//             <h3 className="text-lg font-semibold mb-4">Automated approval process</h3>
//             <ul className="space-y-2 text-white">
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Features
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Pricing
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   API
//                 </a>
//               </li>
//             </ul>
//           </div>
//           <div>
//             <h3 className="text-lg font-semibold mb-4">Company</h3>
//             <ul className="space-y-2 text-white">
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   About
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Blog
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Careers
//                 </a>
//               </li>
//             </ul>
//           </div>
//           <div>
//             <h3 className="text-lg font-semibold mb-4">Support</h3>
//             <ul className="space-y-2 text-white">
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Help Center
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Contact
//                 </a>
//               </li>
//               <li>
//                 <a href="#" className="hover:text-white transition-colors">
//                   Status
//                 </a>
//               </li>
//             </ul>
//           </div>
//         </div>
//         <div className="border-t border-gray-800 mt-8 pt-8 text-center text-white">





//          <p className="text-sm text-gray-300">
//           Powered by <a href="https://www.primetechplc.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">PRIME Software Plc</a> © 2025

//           </p>

//         </div>
//       </div>
//     </footer>
//   )
// } 

"use client"
import Link from "next/link"
import React from "react"

export default function Footer() {
  return (
    <footer className="bg-[#115db1] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="text-2xl font-bold text-white mb-4">Pazimo</div>
            <p className="text-white">
              Connecting event organizers to the global market with powerful, easy-to-use tools.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Features</h3>
            <ul className="space-y-2 text-white">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Event Management
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  API
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3 text-gray-200">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms and Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-white">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a href="/contact" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Status
                </a>
              </li>
            </ul>
          </div>
         
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-white">
         <p className="text-sm text-gray-300">
          Powered by <a href="https://www.primetechplc.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">PRIME Software Plc</a> © 2025
          </p>
        </div>
      </div>
    </footer>
  )
}
