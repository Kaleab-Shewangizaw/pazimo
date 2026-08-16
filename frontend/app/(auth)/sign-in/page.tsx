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

      // No admin branch here on purpose: admins are turned away above and sent
      // to the admin login, so a redirect for them would be unreachable.
      if (currentUser?.role === "venue") {
        router.push("/venue");
      } else if (currentUser?.role === "cinema") {
        router.push("/cinema");
      } else if (currentUser?.role === "organizer") {
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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white dark:bg-[#0A0A0A] transition-colors duration-300">
      {/* Back button */}
      <div className="absolute top-6 left-6 z-30">
        <Link href="/" className="inline-flex items-center gap-2 text-[#2563eb] dark:text-blue-400 hover:underline">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to home</span>
        </Link>
      </div>

      {/* Floating Card */}
      <div className="relative z-20 flex items-center justify-center w-full px-4 py-12 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 16 }}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1D24] shadow-2xl p-8 space-y-8 border border-transparent dark:border-white/10 transition-colors"
        >
          {/* Logo */}
          <div className="flex items-center mx-auto justify-center gap-2">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-lg">
              <Image
                src="/pazimoLogo.jpg"
                alt="Pazimo Logo"
                fill
                className="rounded-md object-contain"
              />
            </div>
            {/* <span className="font-display text-xl font-bold tracking-tight">
              Pazimo
            </span> */}
          </div>

          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="mt-2 text-muted-foreground">
              Sign in here.
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
                className="h-12 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-sm text-[#2563eb] dark:text-blue-400 hover:underline"
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
                  className="h-12 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 pr-12 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
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
              className="h-12 w-full font-display font-semibold text-base bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] dark:shadow-none transition-all"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/organizer-registration" target="_blank" className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium">
                Contact sales
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Back to {" "}
              <Link href="/" className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium">
                Home
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
