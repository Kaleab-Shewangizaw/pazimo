"use client";

import { useState } from "react";
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
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api";

type Mode = "password" | "otp-request" | "otp-verify";
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
                <Label htmlFor="password">Password</Label>
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
      </Card>
    </div>
  );
}
