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
import { accountHomeFor, hasOwnDashboard } from "@/lib/account-home";

const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api";
const RESEND_COOLDOWN_SECONDS = 60;

function CreateAccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, pendingRegisterOtp, setAuth } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set only on EMAIL_TAKEN/PHONE_TAKEN (see authController.js register()) —
  // offers a straight shortcut into sign-in instead of just an error string.
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [otpStep, setOtpStep] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const completeSignUp = (currentUser: ReturnType<typeof useAuthStore.getState>["user"]) => {
    toast.success("Account created! Welcome to Pazimo.", { duration: 3000 });

    const nextUrl = searchParams.get("next");

    if (hasOwnDashboard(currentUser?.role)) {
      router.push(accountHomeFor(currentUser?.role));
      return;
    }
    if (nextUrl) {
      try {
        const url = new URL(nextUrl, window.location.origin);
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search + url.hash);
          return;
        }
      } catch {
        // fall through to home
      }
    }
    router.push("/");
  };

  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 9 && /^[79]/.test(phoneDigits);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);

    if (fullName.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (!phoneValid) {
      toast.error("Enter a 9-digit Ethiopian number, e.g. 912345678.");
      return;
    }
    if (password.length < 6) {
      toast.error("Use a password with at least 6 characters.");
      return;
    }

    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || undefined;

    setIsSubmitting(true);
    try {
      await signup({
        firstName,
        lastName,
        phoneNumber: `+251${phoneDigits}`,
        email: email.trim() || undefined,
        password,
        role: "customer",
      });

      const pending = useAuthStore.getState().pendingRegisterOtp;
      if (pending) {
        setCode("");
        setOtpStep(true);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success(`We sent a verification code to ${pending.maskedDestination ?? "your phone"}`);
        return;
      }

      completeSignUp(useAuthStore.getState().user);
    } catch (error) {
      const code = (error as Error & { code?: string })?.code;
      if (code === "EMAIL_TAKEN" || code === "PHONE_TAKEN") {
        setDuplicateError(error instanceof Error ? error.message : "That account already exists.");
      } else {
        toast.error(error instanceof Error ? error.message : "Could not create your account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const pending = useAuthStore.getState().pendingRegisterOtp;
    if (!pending) {
      setOtpStep(false);
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch(`${API_URL}/auth/verify-register-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      completeSignUp(user);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid or expired code");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    const pending = useAuthStore.getState().pendingRegisterOtp;
    if (!pending) return;
    setIsResending(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-register-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pending.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend code");

      useAuthStore.setState({
        pendingRegisterOtp: {
          email: pending.email,
          channel: pending.channel,
          maskedDestination: data.maskedDestination ?? pending.maskedDestination,
        },
      });
      setCode("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
      <div className="absolute top-6 left-6 z-30">
        <Link href="/" className="inline-flex items-center gap-2 text-[#2563eb] dark:text-blue-400 hover:underline">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to home</span>
        </Link>
      </div>

      <div className="relative z-20 flex items-center justify-center w-full px-4 py-12 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 110, damping: 16 }}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1A1D24] shadow-2xl p-8 space-y-8 border border-transparent dark:border-white/10 transition-colors"
        >
          <div className="flex items-center mx-auto justify-center gap-2">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-lg">
              <Image
                src="/pazimoLogo.jpg"
                alt="Pazimo Logo"
                fill
                className="rounded-md object-contain"
              />
            </div>
          </div>

          <div className="text-center">
            <h1 className="font-display text-3xl font-bold text-gray-900 dark:text-white">
              {otpStep ? "Verify your phone" : "Create your account"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {otpStep
                ? `Enter the code we sent to ${pendingRegisterOtp?.maskedDestination ?? "your phone"}`
                : "Buy tickets faster next time — sign in once, not every checkout."}
            </p>
          </div>

          {otpStep ? (
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
                  {isVerifying ? "Verifying..." : "Verify & create account"}
                </Button>
              </form>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending || resendCooldown > 0}
                  className="text-sm text-[#2563eb] dark:text-blue-400 hover:underline disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending
                    ? "Resending..."
                    : resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                </button>
                <p className="text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false);
                      setCode("");
                      setResendCooldown(0);
                    }}
                    className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium"
                  >
                    Back
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Abebe Kebede"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-12 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      +251
                    </span>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="912345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      required
                      className="h-12 pl-16 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      autoComplete="new-password"
                      required
                      className="h-12 bg-secondary dark:bg-[#0A0A0A] border-border dark:border-white/10 pr-12 placeholder:text-muted-foreground dark:text-white focus-visible:ring-[#2563eb]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {duplicateError && (
                  <p className="text-sm text-red-500 dark:text-red-400">
                    {duplicateError}{" "}
                    <Link href="/sign-in" className="underline font-medium">
                      Sign in instead
                    </Link>
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full font-display font-semibold text-base bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] dark:shadow-none transition-all"
                >
                  {isSubmitting ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/sign-in" className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
                <p className="text-sm text-muted-foreground">
                  Back to{" "}
                  <Link href="/" className="text-[#2563eb] dark:text-blue-400 hover:underline font-medium">
                    Home
                  </Link>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function CreateAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-[#2563eb] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CreateAccountContent />
    </Suspense>
  );
}
