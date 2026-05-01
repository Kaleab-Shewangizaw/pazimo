import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-t border-accent/12 bg-[#06283D] text-white py-10">
      <div className="container mx-auto flex flex-col gap-8 px-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          {/* <img
            src="/logo.png"
            alt="Pazimo"
             className="w-35 h-auto transition-transform duration-200 group-hover:scale-105"
          /> */}
          <h1 className="mb-4 text-lg font-semibold uppercase tracking-wider text-accent">PAZIMO</h1>
          <p className="max-w-md text-sm text-slate-200/90">
            Pazimo is an event ticketing and event management platform in Ethiopia that helps organizers create events, sell tickets online, manage attendees, and deliver seamless event experiences.

Serving event organizers across Addis Ababa and Ethiopia 🇪🇹.
          </p>
        </div>

        <div className="grid gap-8 grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </p>
            <div className="flex flex-col gap-3 text-sm text-slate-200/90">
              <a href="#features" className="transition-colors hover:text-white/90">
                Features
              </a>
              <a href="#pricing" className="transition-colors hover:text-white/90">
                Pricing
              </a>
              <a href="#about" className="transition-colors hover:text-white/90">
                About
              </a>
              <Link href="/contact" className="transition-colors hover:text-white/90">
                Contact Us
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Organizer Access
            </p>
            <div className="flex flex-col gap-3 text-sm text-slate-200/90">
              <Link href="/organizer/sign-in" className="transition-colors hover:text-white/90">
                Sign In
              </Link>
              <Link href="/organizer-registration/register" className="transition-colors hover:text-white/90">
                Start Registration
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-white/90">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-200/80 md:self-end">
          © {new Date().getFullYear()} Pazimo. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
