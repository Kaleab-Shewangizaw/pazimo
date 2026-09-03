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

const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setAuth, pendingOtp } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Second-factor step for organizers (added 2026-09-04): password is
  // verified server-side first, then a code is required before a token is
  // issued. `otpStep` mirrors whether authStore.pendingOtp is currently set.
  const [otpStep, setOtpStep] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Shared by the plain-password path (non-organizers) and the post-OTP
  // path — same redirect decision either way, just reached differently.
  const completeSignIn = (currentUser: ReturnType<typeof useAuthStore.getState>["user"]) => {
    if (currentUser?.role === "admin") {
      toast.error("Admins must use the admin login page.");
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });

      const pending = useAuthStore.getState().pendingOtp;
      if (pending) {
        setCode("");
        setOtpStep(true);
        toast.success(`We sent a verification code to ${pending.maskedDestination ?? "your device"}`);
        return;
      }

      completeSignIn(useAuthStore.getState().user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const pending = useAuthStore.getState().pendingOtp;
    if (!pending) {
      // Shouldn't happen (the OTP form only renders while this is set), but
      // don't leave the user stuck on a form that can't succeed.
      setOtpStep(false);
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // pending.email is the email the backend just confirmed the
        // password against — not the raw form input, which could differ in
        // case/whitespace from what's actually on the account.
        body: JSON.stringify({ email: pending.email, code }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid or expired code");
      }

      const user = data.data?.user;
      const token = data.data?.token;
      if (!user || !token) {
        throw new Error("Unexpected response from server");
      }

      setAuth({ user, token });
      completeSignIn(user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid or expired code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    const pending = useAuthStore.getState().pendingOtp;
    if (!pending) return;
    setIsResending(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email, channel: pending.channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend code");
      toast.success(data.message || "Code resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend code");
    } finally {
      setIsResending(false);
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
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
              {otpStep ? "Verify it's you" : "Welcome back"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {otpStep
                ? `Enter the code we sent to ${pendingOtp?.maskedDestination ?? "your device"}`
                : "Sign in here."}
            </p>
          </div>

          {!otpStep ? (
            <>
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
            </>
          ) : (
            <>
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Verification code</Label>
                  <Input
                    id="otp-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    className="h-12 text-center text-lg tracking-[0.5em] bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isVerifying || code.length !== 6}
                  className="h-12 w-full font-display font-semibold text-base bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] dark:shadow-none transition-all"
                >
                  {isVerifying ? "Verifying..." : "Verify & sign in"}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-sm text-[#2563eb] dark:text-blue-400 hover:underline"
                >
                  {isResending ? "Resending..." : "Resend code"}
                </button>
                <p className="text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setCode("");
                    }}
                    className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium"
                  >
                    Back to sign in
                  </button>
                </p>
              </div>
            </>
          )}
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
