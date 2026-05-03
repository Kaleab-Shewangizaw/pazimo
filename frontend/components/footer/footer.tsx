import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Linkedin, X } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6"




export default function Footer() {
  const currentYear = new Date().getFullYear();
  

  return (
    <footer
      className={`border-t border-accent/12 bg-[#06283D] text-white py-10`}
    >
      <div className="container mx-auto px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Pazimo & App Download */}
          <div className="lg:col-span-1">
            <h3
              className="text-xl font-bold mb-4  text-[#ffd900]"
            >
              Pazimo
            </h3>
            <p
              className={`text-gray-200
              mb-6`}
            >
              Your one-stop destination for discovering and booking tickets for
              the best events.
            </p>
            <div className="space-y-3">
              <p className="font-semibold text-white">Download the App</p>
              <div className="flex gap-3">
                <Link
                  href="#"
                  className="inline-block transition-transform hover:scale-105"
                >
                  <Image
                    src="/footer/applestore.png"
                    alt="Download on the App Store"
                    width={135}
                    height={40}
                  />
                </Link>
                <Link
                  href="#"
                  className="inline-block transition-transform hover:scale-105"
                >
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
            <h4
              className={`text-lg font-semibold mb-4 text-white
              `}
            >
              Quick Links
            </h4>
            <ul
              className={`space-y-3 text-gray-200
              `}
            >
              <li>
                <Link href="/organizer-registration" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/event_explore"
                  className="hover:text-white transition-colors"
                >
                  Explore Events
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div>
            <h4
              className={`text-lg font-semibold mb-4 text-white
              `}
            >
              Legal
            </h4>
            <ul
              className={`space-y-3 text-gray-200`}
            >
              <li>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors"
                >
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

        
          <div>
            <h4
              className={`text-lg font-semibold mb-4 text-white`}
            >
              For Organizers
            </h4>
            <p
              className={`text-gray-200 mb-4`}
            >
              Host your event with us and reach millions of users.
            </p>
            <Link href="/organizer-registration">
              <Button className="bg-white text-[#0D47A1] hover:bg-gray-200 font-bold w-full transition-colors">
                Register Your Event
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-300">
            Powered by{" "}
            <a
              href="https://www.primetechplc.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white"
            >
              PRIME Software Plc
            </a>{" "}
            ©{currentYear}
          </p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Link
              href="#"
              aria-label="Facebook"
              className="text-gray-300 hover:text-white transition-colors"
            >
              <Facebook className="h-5 w-5" />
            </Link>
            <Link
              href="https://x.com/Pazimo_events"
              aria-label="X"
              className="text-gray-300 hover:text-white transition-colors"
            >
              <FaXTwitter className="h-5 w-5" />
            </Link>
            <Link
              href="https://www.instagram.com/pazimo.events?igsh=MW51emUzbzR1ZXBuaw=="
              aria-label="Instagram"
              className="text-gray-300 hover:text-white transition-colors"
            >
              <Instagram className="h-5 w-5" />
            </Link>
            <Link
              href="#"
              aria-label="LinkedIn"
              className="text-gray-300 hover:text-white transition-colors"
            >
              <Linkedin className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
