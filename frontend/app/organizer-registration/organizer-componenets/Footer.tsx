import Image from "next/image";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="container mx-auto flex flex-col gap-8 px-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-4">
          <Image
            src="/images/paz/logo.png"
            alt="Pazimo"
            width={160}
            height={80}
            className="h-20 w-auto"
          />
          <p className="max-w-xs text-sm text-muted-foreground">
            Build, manage, and grow your events with Pazimo.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Quick Links
            </p>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
              <a href="#pricing" className="transition-colors hover:text-foreground">
                Pricing
              </a>
              <a href="#about" className="transition-colors hover:text-foreground">
                About
              </a>
              <Link href="/organizer-registration/register" className="transition-colors hover:text-foreground">
                Register Now
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Organizer Access
            </p>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link href="/organizer/sign-in" className="transition-colors hover:text-foreground">
                Sign In
              </Link>
              <Link href="/organizer-registration/register" className="transition-colors hover:text-foreground">
                Start Registration
              </Link>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground md:self-end">
          © {new Date().getFullYear()} Pazimo. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
