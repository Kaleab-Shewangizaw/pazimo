import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEventStore } from "./eventStore";

interface User {
  _id?: string;
  id?: string;
  email: string;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  // "cashier" is a cinema's or venue's own counter staff — scoped to a
  // single business, added alongside the cashier-management feature.
  role: "customer" | "organizer" | "venue" | "admin" | "cinema" | "cashier";
  // Only ever set when role is "cashier" — which single cinema/venue this
  // login is scoped to. A cashier reads this instead of GET /me (owner-only)
  // to know which business's endpoints to call.
  cinema?: string | null;
  venue?: string | null;
}

interface PendingOtp {
  email: string;
  channel: "sms" | "email";
  maskedDestination: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  error: string | null;
  isBanned: boolean;
  banReason: string | null;
  // Set by login() when the account requires a second factor (organizers,
  // added 2026-09-04, or any customer with 2FA turned on in Settings)
  // instead of getting a token immediately. The caller should check this
  // after awaiting login() — if set, show a code-entry step and complete
  // sign-in via POST /api/auth/organizer/verify-otp using pendingOtp.email
  // (never the raw form input, which may not match the account's real email
  // exactly) and the code the user enters, then call setAuth() with the
  // result.
  pendingOtp: PendingOtp | null;
  // Set by signup() when REGISTER_PHONE_OTP_ENABLED is on (added
  // 2026-09-16) instead of getting a token immediately — the account exists
  // but isPhoneVerified is still false. Kept separate from pendingOtp: this
  // completes via POST /api/auth/verify-register-otp /
  // /api/auth/resend-register-otp, a different pair of endpoints than the
  // organizer login second factor above.
  pendingRegisterOtp: PendingOtp | null;
  setBanned: (reason: string | null) => void;
  checkAccountStatus: () => Promise<void>;
  signup: (userData: {
    email?: string;
    password: string;
    firstName: string;
    lastName?: string;
    phoneNumber: string;
    role: "customer" | "organizer";
  }) => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuth: (authData: { user: User; token: string }) => void;
  isAuthenticated: boolean;
}

// Make sure this matches your backend port
const API_URL = process.env.NEXT_PUBLIC_API_URL + "/api";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      error: null,
      isAuthenticated: false,
      isBanned: false,
      banReason: null,
      pendingOtp: null,
      pendingRegisterOtp: null,
      setBanned: (reason) => set({ isBanned: true, banReason: reason }),
      checkAccountStatus: async () => {
        const { token } = useAuthStore.getState();
        if (!token) return;

        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 403) {
            const data = await response.json().catch(() => null);
            if (data?.code === "ACCOUNT_BANNED") {
              set({ isBanned: true, banReason: data.message || null });
            }
          }
        } catch (error) {
          // Network hiccup — don't block the app over a status check.
        }
      },
      signup: async (userData) => {
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(userData),
          });

          const data = await response.json();

          if (!response.ok) {
            // EMAIL_TAKEN/PHONE_TAKEN (see authController.js register()) lets
            // the caller offer "log in instead" rather than just showing
            // this message — attached onto the Error since fetch failures
            // here only ever carry a plain Error, not authStore's own type.
            const err = new Error(data.message || "Registration failed") as Error & {
              code?: string;
            };
            err.code = data.code;
            throw err;
          }

          // Password verified server-side, but the phone still needs to be
          // confirmed (REGISTER_PHONE_OTP_ENABLED, added 2026-09-16) before a
          // token is issued. Not an error — the caller should check
          // pendingRegisterOtp after awaiting signup() and show a code-entry
          // step, then complete via /api/auth/verify-register-otp.
          if (data.requiresOtp) {
            set({
              pendingRegisterOtp: {
                email: data.data?.email,
                channel: data.data?.channel || "sms",
                maskedDestination: data.data?.maskedDestination ?? null,
              },
              error: null,
            });
            return;
          }

          set({
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            error: null,
            pendingRegisterOtp: null,
          });
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : "Network error occurred",
          });
          throw error;
        }
      },
      login: async (credentials: { email: string; password: string }) => {
        try {
          // console.log('Attempting to login to:', `${API_URL}/auth/login`);

          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(credentials),
          });

          // Log the response status and headers
          // console.log('Response status:', response.status);
          // console.log('Response headers:', Object.fromEntries(response.headers.entries()));

          // Check if the response is JSON
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            // console.error('Non-JSON response:', text);
            throw new Error(
              "Server returned non-JSON response. Please check if the server is running."
            );
          }

          const data = await response.json();
          // console.log('Login response:', data);

          if (!response.ok) {
            throw new Error(data.message || "Login failed");
          }

          // Password verified, but this account (organizers, as of
          // 2026-09-04) needs a code before a token is issued. Not an
          // error — the caller should check pendingOtp after awaiting
          // login() and show a code-entry step instead of treating this as
          // signed in.
          if (data.requiresOtp) {
            set({
              pendingOtp: {
                email: data.data?.email,
                channel: data.data?.channel || "sms",
                maskedDestination: data.data?.maskedDestination ?? null,
              },
              error: null,
            });
            return;
          }

          // Check if we have the user data in the expected format
          const userData = data.data?.user;
          const token = data.data?.token;

          if (!userData || !token) {
            // console.error('Invalid response structure:', data);
            throw new Error("Invalid response format from server");
          }

          // Set the auth state
          set({
            user: userData,
            token: token,
            isAuthenticated: true,
            error: null,
            pendingOtp: null,
          });

          // Store in localStorage for persistence
          localStorage.setItem(
            "auth-storage",
            JSON.stringify({
              state: {
                user: userData,
                token: token,
                isAuthenticated: true,
              },
            })
          );
        } catch (error) {
          // console.error('Login error:', error);
          set({
            error:
              error instanceof Error ? error.message : "Network error occurred",
            isAuthenticated: false,
            user: null,
            token: null,
          });
          throw error;
        }
      },
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
          isBanned: false,
          banReason: null,
          pendingOtp: null,
          pendingRegisterOtp: null,
        });
        // Clear localStorage
        localStorage.removeItem("auth-storage");
        useEventStore.getState().clearEvents();
      },
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setAuth: (authData) => {
        set({
          user: authData.user,
          token: authData.token,
          isAuthenticated: true,
          error: null,
          pendingOtp: null,
          pendingRegisterOtp: null,
        });
        // Store in localStorage for persistence
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              user: authData.user,
              token: authData.token,
              isAuthenticated: true,
            },
          })
        );
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
