"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import Image from "next/image";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      const currentUser = useAuthStore.getState().user;

      if (currentUser?.role === "admin") {
        toast.error("Admins must use the admin login page.");
        setIsSubmitting(false);
        return;
      }

      toast.success("Welcome back! You're logged in.", { duration: 3000 });

      const nextUrl = searchParams.get("next");

      if (currentUser?.role === "organizer") {
        router.push("/organizer");
      } else if (nextUrl) {
        try {
          const url = new URL(nextUrl, window.location.origin);
          if (url.origin === window.location.origin) {
            router.push(url.pathname + url.search + url.hash);
          } else {
            router.push("/");
          }
        } catch {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — Branding */}
      <div className="relative hidden w-1/2 lg:block">
        <Image
          src="/event-hero.jpg"
          alt="Concert crowd with golden stage lights"
          fill
          className="absolute inset-0 h-full w-full object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute bottom-16 left-10 right-10"
        >
          <div className="mb-6 flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Back to Homepage</span>
            </Link>
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight text-white">
            Every great event
            <br />
            begins with <span className="text-[#2563eb]">Pazimo.</span>
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            Sell, scan, and manage events from one powerful dashboard. Trusted by
            500+ promoters worldwide.
          </p>
        </motion.div>
      </div>

      {/* Right — Form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 relative items-center justify-center rounded-lg">
              <Image
                src="/mobile_logo.png"
                alt="Pazimo Logo"
                fill
                className="h-6 w-6 rounded-md object-fill"
              />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">
              Pazimo
            </span>
          </div>

          <div>
            <h1 className="font-display text-3xl font-bold">Welcome back</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in to manage your events and sales.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-secondary border-border placeholder:text-muted-foreground focus-visible:ring-[#2563eb]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-sm text-[#2563eb] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-secondary border-border pr-12 placeholder:text-muted-foreground focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full font-display font-semibold text-base bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="https://pazimo-organizer.vercel.app/" target="_blank" className="text-[#2563eb] hover:underline font-medium">
                Contact sales
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
