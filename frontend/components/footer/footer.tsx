"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Linkedin, X } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { useEffect, useState } from "react";

type FooterVariant = "default" | "signature";

type FooterProps = {
  variant?: FooterVariant;
};

export default function Footer({ variant = "default" }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [isOpen, setIsOpen] = useState(false);
  const footerTitle = variant === "signature" ? "Pazimo Signature" : "PAZIMO";
  const footerDescription =
    variant === "signature"
      ? "Pazimo is an event ticketing and event management platform in Ethiopia that helps organizers create events, sell tickets online, manage attendees, and deliver seamless event experiences."
      : "Pazimo is an event ticketing and management platform in Ethiopia that helps organizers create events, sell tickets online, and manage guests seamlessly.";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[#06283D] px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
          aria-label="Open footer"
        >
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#ffd900]" />
          Terms, privacy and more
        </button>
      )}

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsOpen(false)}
          aria-label="Close footer overlay"
        />

        <aside
          className={`absolute inset-x-0 bottom-0 z-[60] h-auto max-h-[calc(100dvh-1rem)] w-full overflow-y-auto border-t border-white/10 bg-[#06283D] text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)] transition-transform duration-300 sm:max-h-[min(90vh,860px)] ${
            isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/20 pb-8 pt-1">
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 w-full">
                <div className="col-span-2 md:col-span-1">
                  <h3 className="mb-4 text-xl font-bold text-[#ffd900]">{footerTitle}</h3>
                  <p className="mb-6 -mr-5 text-gray-200 lg:mr-6">{footerDescription}</p>
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

                <div>
                  <h4 className="mb-4 text-lg font-semibold text-white">Quick Links</h4>
                  <ul className="space-y-3 text-gray-200">
                    <li>
                      <Link href="/organizer-registration" className="transition-colors hover:text-white">
                        About Us
                      </Link>
                    </li>
                    <li>
                      <Link href="/event_explore" className="transition-colors hover:text-white">
                        Explore Events
                      </Link>
                    </li>
                    <li>
                      <Link href="/contact" className="transition-colors hover:text-white">
                        Contact Us
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-4 text-lg font-semibold text-white">Legal</h4>
                  <ul className="space-y-3 text-gray-200">
                    <li>
                      <Link href="/terms" className="transition-colors hover:text-white">
                        Terms and Conditions
                      </Link>
                    </li>
                    <li>
                      <Link href="/privacy" className="transition-colors hover:text-white">
                        Privacy Policy
                      </Link>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="mb-4 text-lg font-semibold text-white">For Organizers</h4>
                  <p className="mb-4 text-gray-200">Host your event with us and reach millions of users.</p>
                  <Link href="/organizer-registration">
                    <Button className="w-full bg-white font-bold text-[#0D47A1] transition-colors hover:bg-gray-200">
                      Register Your Event
                    </Button>
                  </Link>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white absolute right-4 top-4"
                aria-label="Close footer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-8 flex flex-col items-center justify-between gap-4 pt-2 sm:flex-row">
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
              <div className="flex space-x-4">
                <Link href="#" aria-label="Facebook" className="text-gray-300 transition-colors hover:text-white">
                  <Facebook className="h-5 w-5" />
                </Link>
                <Link href="https://x.com/Pazimo_events" aria-label="X" className="text-gray-300 transition-colors hover:text-white">
                  <FaXTwitter className="h-5 w-5" />
                </Link>
                <Link href="https://www.instagram.com/pazimo.events?igsh=MW51emUzbzR1ZXBuaw==" aria-label="Instagram" className="text-gray-300 transition-colors hover:text-white">
                  <Instagram className="h-5 w-5" />
                </Link>
                <Link href="#" aria-label="LinkedIn" className="text-gray-300 transition-colors hover:text-white">
                  <Linkedin className="h-5 w-5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
