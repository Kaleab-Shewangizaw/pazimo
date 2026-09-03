"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/ui/password-field";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api";
const RESEND_COOLDOWN_SECONDS = 60;

type Mode =
  | "password"
  | "otp-request"
  | "otp-verify"
  | "forgot-request"
  | "forgot-verify"
  | "forgot-reset";
type Channel = "sms" | "email";

export default function OrganizerSignInPage() {
  const router = useRouter();
  const { login, setAuth } = useAuthStore();
  const [mode, setMode] = useState<Mode>("password");
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // OTP login state
  const [otpEmail, setOtpEmail] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // Forgot-password state (added 2026-09-03) — separate from the sign-in-
  // with-a-code state above even though the shape is similar, since the two
  // flows hit different endpoints (forgot-password codes can never be used
  // to sign in, and vice versa — see authController.js). Three real steps:
  // enter email/phone -> enter+verify the code -> choose a new password.
  // forgotCode is kept in state across the last two steps rather than asked
  // for twice: it's already confirmed correct by the time the change-
  // password screen shows, so resetPasswordWithCode on the backend just
  // rechecks the same code silently.
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotChannel, setForgotChannel] = useState<Channel>("sms");
  const [forgotMaskedDestination, setForgotMaskedDestination] = useState<string | null>(null);
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  // Gates the "Resend code" button on the verify step at a minute between
  // sends — a real SMS/email goes out each time (passwordResetSendLimiter
  // on the backend is the hard cap; this is just so a bored click doesn't
  // burn through that budget).
  const [forgotResendCooldown, setForgotResendCooldown] = useState(0);
  const [isResendingResetCode, setIsResendingResetCode] = useState(false);

  useEffect(() => {
    if (forgotResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setForgotResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [forgotResendCooldown]);

  const finishLoginAsOrganizer = (router_push = "/organizer/events") => {
    const user = useAuthStore.getState().user;
    if (user?.role !== "organizer") {
      throw new Error("Access denied. Only organizers can sign in here.");
    }
    toast.success("Signed in successfully");
    router.push(router_push);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(formData);
      finishLoginAsOrganizer();
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, channel }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }

      setMaskedDestination(data.maskedDestination || null);
      setCode("");
      setMode("otp-verify");
      toast.success(data.message || "Verification code sent");
    } catch (error) {
      console.error("Send OTP error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send verification code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code }),
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
      finishLoginAsOrganizer();
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast.error(error instanceof Error ? error.message : "Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier, channel: forgotChannel }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to send reset code");
      }

      setForgotMaskedDestination(data.maskedDestination || null);
      setForgotCode("");
      setForgotResendCooldown(RESEND_COOLDOWN_SECONDS);
      setMode("forgot-verify");
      toast.success(data.message || "Reset code sent");
    } catch (error) {
      console.error("Send reset code error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send reset code");
    } finally {
      setIsLoading(false);
    }
  };

  // Re-sends without leaving the verify screen or re-typing the email/phone
  // — same identifier+channel already on file for this attempt.
  const handleResendResetCode = async () => {
    setIsResendingResetCode(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier, channel: forgotChannel }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to resend code");
      }

      setForgotMaskedDestination(data.maskedDestination || null);
      setForgotCode("");
      setForgotResendCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success(data.message || "Code resent");
    } catch (error) {
      console.error("Resend reset code error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to resend code");
    } finally {
      setIsResendingResetCode(false);
    }
  };

  // Confirms the code server-side before showing the change-password
  // screen — "once they got it right" — rather than letting the user type a
  // new password only to find out the code was wrong at the very end.
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/verify-reset-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: forgotIdentifier, code: forgotCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Invalid or expired code");
      }

      setNewPassword("");
      setConfirmNewPassword("");
      setMode("forgot-reset");
    } catch (error) {
      console.error("Verify reset code error:", error);
      toast.error(error instanceof Error ? error.message : "Invalid or expired code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/organizer/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // forgotCode was already confirmed correct in handleVerifyResetCode
        // — resubmitted here (not re-typed by the user) so the backend can
        // check it once more atomically with setting the new password.
        body: JSON.stringify({ identifier: forgotIdentifier, code: forgotCode, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to reset password");
      }

      const user = data.data?.user;
      const token = data.data?.token;
      if (!user || !token) {
        throw new Error("Unexpected response from server");
      }

      setAuth({ user, token });
      toast.success("Password reset — you're signed in");
      finishLoginAsOrganizer();
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle>Organizer Sign In</CardTitle>
          <CardDescription>
            {mode === "otp-verify"
              ? `Enter the code we sent to ${maskedDestination ?? "your device"}`
              : mode === "otp-request"
                ? "We'll send a one-time code to sign you in"
                : mode === "forgot-request"
                  ? "We'll send a code to reset your password"
                  : mode === "forgot-verify"
                    ? `Enter the code we sent to ${forgotMaskedDestination ?? "your device"}`
                    : mode === "forgot-reset"
                      ? "Choose a new password for your account"
                      : "Sign in to manage your events"}
          </CardDescription>
        </CardHeader>

        {mode === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      setForgotIdentifier(formData.email);
                      setMode("forgot-request");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setOtpEmail(formData.email);
                  setMode("otp-request");
                }}
              >
                Sign in with a code instead
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/organizer/sign-up")}
              >
                Create Account
              </Button>
            </CardFooter>
          </form>
        )}

        {mode === "otp-request" && (
          <form onSubmit={handleSendOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp-email">Email</Label>
                <Input
                  id="otp-email"
                  type="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="Enter your organizer email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Send the code via</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={channel === "sms" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setChannel("sms")}
                  >
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant={channel === "email" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setChannel("email")}
                  >
                    Email
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("password")}
              >
                Back to password sign in
              </Button>
            </CardFooter>
          </form>
        )}

        {mode === "otp-verify" && (
          <form onSubmit={handleVerifyOtp}>
            <CardContent className="space-y-4">
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
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify & sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("otp-request")}
              >
                Send a new code
              </Button>
            </CardFooter>
          </form>
        )}

        {mode === "forgot-request" && (
          <form onSubmit={handleSendResetCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-identifier">Email or phone number</Label>
                <Input
                  id="forgot-identifier"
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Enter your organizer email or phone number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Send the code via</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={forgotChannel === "sms" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setForgotChannel("sms")}
                  >
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant={forgotChannel === "email" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setForgotChannel("email")}
                  >
                    Email
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send reset code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("password")}
              >
                Back to password sign in
              </Button>
            </CardFooter>
          </form>
        )}

        {mode === "forgot-verify" && (
          <form onSubmit={handleVerifyResetCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-code">Verification code</Label>
                <Input
                  id="forgot-code"
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || forgotCode.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleResendResetCode}
                disabled={isResendingResetCode || forgotResendCooldown > 0}
              >
                {isResendingResetCode
                  ? "Resending..."
                  : forgotResendCooldown > 0
                    ? `Resend code in ${forgotResendCooldown}s`
                    : "Resend code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("forgot-request")}
              >
                Use a different email or phone
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setMode("password")}
              >
                Back to password sign in
              </Button>
            </CardFooter>
          </form>
        )}

        {mode === "forgot-reset" && (
          <form onSubmit={handleResetPassword}>
            <CardContent className="space-y-4">
              <PasswordField
                label="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 6 characters"
              />
              <PasswordField
                label="Confirm new password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
                placeholder="Re-enter new password"
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Resetting..." : "Reset password & sign in"}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
