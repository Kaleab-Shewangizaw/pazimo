import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEventStore } from './eventStore'

interface User {
  _id?: string;
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: 'customer' | 'organizer' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  error: string | null;
  signup: (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    role: 'customer' | 'organizer';
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
const API_URL = process.env.NEXT_PUBLIC_API_URL + '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      error: null,
      isAuthenticated: false,
      signup: async (userData) => {
        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(userData),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
          }

          set({ 
            user: data.data.user,
            token: data.data.token,
            isAuthenticated: true,
            error: null
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Network error occurred'
          });
          throw error;
        }
      },
      login: async (credentials: { email: string; password: string }) => {
        try {
          // console.log('Attempting to login to:', `${API_URL}/auth/login`);
          
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          // Log the response status and headers
          // console.log('Response status:', response.status);
          // console.log('Response headers:', Object.fromEntries(response.headers.entries()));

          // Check if the response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            // console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Please check if the server is running.');
          }

          const data = await response.json();
          // console.log('Login response:', data);

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          // Check if we have the user data in the expected format
          const userData = data.data?.user;
          const token = data.data?.token;

          if (!userData || !token) {
            // console.error('Invalid response structure:', data);
            throw new Error('Invalid response format from server');
          }

          // Set the auth state
          set({ 
            user: userData,
            token: token,
            isAuthenticated: true,
            error: null
          });

          // Store in localStorage for persistence
          localStorage.setItem('auth-storage', JSON.stringify({
            state: {
              user: userData,
              token: token,
              isAuthenticated: true
            }
          }));
        } catch (error) {
          // console.error('Login error:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Network error occurred',
            isAuthenticated: false,
            user: null,
            token: null
          });
          throw error;
        }
      },
      logout: () => {
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false,
          error: null 
        });
        // Clear localStorage
        localStorage.removeItem('auth-storage');
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
          error: null
        });
        // Store in localStorage for persistence
        localStorage.setItem('auth-storage', JSON.stringify({
          state: {
            user: authData.user,
            token: authData.token,
            isAuthenticated: true
          }
        }));
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
) 