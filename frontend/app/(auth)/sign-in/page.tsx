"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Star,
  ArrowLeft,
} from "lucide-react";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();

  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const validateForm = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please complete the form correctly");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: formData.email, password: formData.password });

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
    <div
      ref={containerRef}
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 30%, #e2e8f0 100%)",
      }}
    >
      {/* Shooting Star Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Shooting Stars Container */}
        <div className="absolute inset-0">
          {/* Shooting Star 1 */}
          <div className="absolute w-[200px] h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent top-1/4 -left-[200px] animate-shooting-star-1">
            <div className="absolute right-0 w-3 h-3 bg-blue-500 rounded-full -translate-y-1/2" />
          </div>

          {/* Shooting Star 2 */}
          <div className="absolute w-[180px] h-[1.5px] bg-gradient-to-r from-transparent via-purple-500 to-transparent top-1/3 -left-[180px] animate-shooting-star-2">
            <div className="absolute right-0 w-2.5 h-2.5 bg-purple-500 rounded-full -translate-y-1/2" />
          </div>

          {/* Shooting Star 3 */}
          <div className="absolute w-[220px] h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent top-2/3 -left-[220px] animate-shooting-star-3">
            <div className="absolute right-0 w-2.5 h-2.5 bg-cyan-500 rounded-full -translate-y-1/2" />
          </div>

          {/* Shooting Star 4 */}
          <div className="absolute w-[150px] h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent top-3/4 -left-[150px] animate-shooting-star-4">
            <div className="absolute right-0 w-3 h-3 bg-indigo-500 rounded-full -translate-y-1/2" />
          </div>
        </div>

        {/* Subtle Grid Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px),
                             linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Gradient Orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-r from-blue-200/20 to-cyan-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-gradient-to-r from-purple-200/20 to-pink-200/20 rounded-full blur-3xl" />

        {/* Subtle Lines Pattern */}
        <div className="absolute inset-0">
          {/* Diagonal Lines */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-300/30 to-transparent" />
          <div className="absolute top-20 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-300/20 to-transparent" />
          <div className="absolute bottom-20 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-300/30 to-transparent" />
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-xl relative z-10 animate-fade-in-up">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 sm:p-10 relative overflow-hidden">
          {/* Card Border Gradient */}
          <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 -z-10">
            <div className="absolute inset-0 rounded-3xl bg-white" />
          </div>

          {/* Card Shine Effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

          <div className="relative z-10">
            {/* Logo and Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center mb-6 p-4  rounded-2xl  ">
                <div className="relative h-14 w-70">
                  <Image
                    fill
                    src="/logo.png"
                    alt="Pazimo Logo"
                    className="h-14 w-auto drop-shadow-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://ui-avatars.com/api/?name=Pazimo&background=0D47A1&color=fff&bold=true&size=128`;
                    }}
                  />
                </div>
              </div>

              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent mb-3">
                SIGN IN
              </h1>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Email Field */}
              <div className="space-y-3">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <div className="relative group">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl transition-all duration-300 ${
                      isFocused === "email"
                        ? "opacity-100 scale-105"
                        : "opacity-0 scale-95"
                    }`}
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors duration-300 group-focus-within:text-blue-500" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-12 h-14 rounded-xl border-gray-200 bg-white/80 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/30 transition-all duration-300 shadow-sm"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setIsFocused("email")}
                    onBlur={() => setIsFocused(null)}
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 animate-shake">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <div className="relative group">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-xl transition-all duration-300 ${
                      isFocused === "password"
                        ? "opacity-100 scale-105"
                        : "opacity-0 scale-95"
                    }`}
                  />
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors duration-300 group-focus-within:text-blue-500" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-12 pr-12 h-14 rounded-xl border-gray-200 bg-white/80 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/30 transition-all duration-300 shadow-sm"
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setIsFocused("password")}
                    onBlur={() => setIsFocused(null)}
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 animate-shake">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white h-14 rounded-xl font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3 group relative overflow-hidden"
                disabled={isSubmitting}
              >
                {/* Button Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                {isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </div>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
              <Link
                href="/"
                className="pt-2 flex items-center gap-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {" "}
                <ArrowLeft /> Back to Homepage
              </Link>
            </form>

            {/* Footer */}
            <div className="mt-10 pt-3 border-t border-gray-100">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  &copy;All Rights Reserved
                </p>
                <div className="mt-4 flex items-center justify-center gap-4">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-gray-200" />
                  <div className="flex items-center gap-2">
                    <Star className="h-3 w-3 text-blue-500 fill-blue-500" />
                    <span className="text-xs text-gray-500">Pazimo</span>
                    <Star className="h-3 w-3 text-cyan-500 fill-cyan-500" />
                  </div>
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Animations */}
      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-5px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(5px);
          }
        }

        @keyframes shooting-star-1 {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 200px)) translateY(100px);
            opacity: 0;
          }
        }

        @keyframes shooting-star-2 {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 180px)) translateY(-50px);
            opacity: 0;
          }
        }

        @keyframes shooting-star-3 {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 220px)) translateY(-100px);
            opacity: 0;
          }
        }

        @keyframes shooting-star-4 {
          0% {
            transform: translateX(0) translateY(0);
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          100% {
            transform: translateX(calc(100vw + 150px)) translateY(50px);
            opacity: 0;
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-shooting-star-1 {
          animation: shooting-star-1 8s linear infinite;
          animation-delay: 0s;
        }

        .animate-shooting-star-2 {
          animation: shooting-star-2 10s linear infinite;
          animation-delay: 2s;
        }

        .animate-shooting-star-3 {
          animation: shooting-star-3 12s linear infinite;
          animation-delay: 4s;
        }

        .animate-shooting-star-4 {
          animation: shooting-star-4 9s linear infinite;
          animation-delay: 6s;
        }
      `}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute inset-0 h-16 w-16 border-4 border-gray-200 border-t-cyan-500 rounded-full animate-spin animation-delay-500" />
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
