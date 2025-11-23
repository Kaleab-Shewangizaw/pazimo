// import Link from "next/link"
// import Image from "next/image"
// import { Button } from "@/components/ui/button"
// import { Facebook, Twitter, Instagram, Linkedin, X } from "lucide-react"

// export default function Footer() {
//   return (
//     <footer className="bg-[#0D47A1] text-white">
//       <div className="container mx-auto px-6 py-12">
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
//           {/* Column 1: Pazimo & App Download */}
//           <div className="lg:col-span-1">
//             <h3 className="text-2xl font-bold text-white mb-4">Pazimo</h3>
//             <p className="text-gray-200 mb-6">
//               Your one-stop destination for discovering and booking tickets for the best events.
//             </p>
//             <div className="space-y-3">
//               <p className="font-semibold text-white">Download the App</p>
//               <div className="flex gap-3">
//                 <Link href="#" className="inline-block transition-transform hover:scale-105">
//                   <Image
//                     src="/footer/applestore.png"
//                     alt="Download on the App Store"
//                     width={135}
//                     height={40}
//                   />
//                 </Link>
//                 <Link href="#" className="inline-block transition-transform hover:scale-105">
//                   <Image
//                     src="/footer/googlestore.png"
//                     alt="Get it on Google Play"
//                     width={135}
//                     height={40}
//                   />
//                 </Link>
//               </div>
//             </div>
//           </div>

//           {/* Column 2: Quick Links */}
//           <div>
//             <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
//             <ul className="space-y-3 text-gray-200">
//               <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
//               <li><Link href="/event_explore" className="hover:text-white transition-colors">Explore Events</Link></li>
//               <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
//               <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
//             </ul>
//           </div>

//           {/* Column 3: Legal */}
//           <div>
//             <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
//             <ul className="space-y-3 text-gray-200">
//               <li><Link href="/terms" className="hover:text-white transition-colors">Terms and Conditions</Link></li>
//               <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
//               <li><Link href="/cancellation" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
//             </ul>
//           </div>

//           {/* Column 4: Event Organizer */}
//           <div>
//             <h4 className="text-lg font-semibold text-white mb-4">For Organizers</h4>
//             <p className="text-gray-200 mb-4">Host your event with us and reach millions of users.</p>
//             <Link href="http://pazimo.com/">
//               <Button className="bg-white text-[#0D47A1] hover:bg-gray-200 font-bold w-full transition-colors">
//                 Register Your Event
//               </Button>
//             </Link>
//           </div>
//         </div>

//         <div className="mt-12 border-t border-white/20 pt-8 flex flex-col sm:flex-row justify-between items-center">
//           <p className="text-sm text-gray-300">
//           Powered by <a href="https://www.primetechplc.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">PRIME Software Plc</a> © 2025

//           </p>
//           <div className="flex space-x-4 mt-4 sm:mt-0">
//             <Link href="#" aria-label="Facebook" className="text-gray-300 hover:text-white transition-colors"><Facebook className="h-5 w-5" /></Link>
//             <Link href="https://x.com/Pazimo_events" aria-label="X" className="text-gray-300 hover:text-white transition-colors"><X className="h-5 w-5" /></Link>
//             <Link href="https://www.instagram.com/pazimo.events?igsh=MW51emUzbzR1ZXBuaw==" aria-label="Instagram" className="text-gray-300 hover:text-white transition-colors"><Instagram className="h-5 w-5" /></Link>
//             <Link href="#" aria-label="LinkedIn" className="text-gray-300 hover:text-white transition-colors"><Linkedin className="h-5 w-5" /></Link>
//           </div>
//         </div>h
//       </div>
//     </footer>
//   )
// }


import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Facebook, Twitter, Instagram, Linkedin, X, Mail } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-[#0D47A1] text-white">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          
          {/* Column 1: Pazimo & App Download */}
          <div className="lg:col-span-1">
            <h3 className="text-2xl font-bold text-white mb-4">Pazimo</h3>
            <p className="text-gray-200 mb-6">
              Your one-stop destination for discovering and booking tickets for the best events.
            </p>
            <div className="space-y-3">
              <p className="font-semibold text-white">Download the App</p>
              <div className="flex gap-3">
                <Link href="#" className="inline-block transition-transform hover:scale-105">
                  <Image
                    src="/footer/applestore.png"
                    alt="Download on the App Store"
                    width={135}
                    height={40}
                  />
                </Link>
                <Link href="#" className="inline-block transition-transform hover:scale-105">
                  <Image
                    src="/footer/googlestore.png"
                    alt="Get it on Google Play"
                    width={135}
                    height={40}
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-3 text-gray-200">
              <li><Link href="#" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/event_explore" className="hover:text-white transition-colors">Explore Events</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3 text-gray-200">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms and Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact */}
                    {/* Column 4: Contact */}
                    {/* <div>
            <h4 className="text-lg font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2 text-gray-200 text-sm">
              <li><a href="mailto:support@pazimo.com" className="hover:text-white transition-colors flex items-center gap-2"><Mail className="h-3 w-3" />support@pazimo.com</a></li>
              <li><a href="mailto:finance@pazimo.com" className="hover:text-white transition-colors flex items-center gap-2"><Mail className="h-3 w-3" />finance@pazimo.com</a></li>
              <li><a href="mailto:info@pazimo.com" className="hover:text-white transition-colors flex items-center gap-2"><Mail className="h-3 w-3" />info@pazimo.com</a></li>
              <li><a href="mailto:organizers@pazimo.com" className="hover:text-white transition-colors flex items-center gap-2"><Mail className="h-3 w-3" />organizers@pazimo.com</a></li>
              <li><a href="mailto:admin@pazimo.com" className="hover:text-white transition-colors flex items-center gap-2"><Mail className="h-3 w-3" />admin@pazimo.com</a></li>
            </ul>
          </div> */}


          {/* Column 5: Event Organizer */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">For Organizers</h4>
            <p className="text-gray-200 mb-4">Host your event with us and reach millions of users.</p>
            <Link href="https://organizer.pazimo.com/">
              <Button className="bg-white text-[#0D47A1] hover:bg-gray-200 font-bold w-full transition-colors">
                Register Your Event
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-300">
          Powered by <a href="https://www.primetechplc.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">PRIME Software Plc</a> © 2025

          </p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link href="#" aria-label="Facebook" className="text-gray-300 hover:text-white transition-colors"><Facebook className="h-5 w-5" /></Link>
            <Link href="https://x.com/Pazimo_events" aria-label="X" className="text-gray-300 hover:text-white transition-colors"><X className="h-5 w-5" /></Link>
            <Link href="https://www.instagram.com/pazimo.events?igsh=MW51emUzbzR1ZXBuaw==" aria-label="Instagram" className="text-gray-300 hover:text-white transition-colors"><Instagram className="h-5 w-5" /></Link>
            <Link href="#" aria-label="LinkedIn" className="text-gray-300 hover:text-white transition-colors"><Linkedin className="h-5 w-5" /></Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
