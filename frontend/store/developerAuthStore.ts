import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DeveloperUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'developer';
}

interface DeveloperAuthState {
  developer: DeveloperUser | null;
  token: string | null;
  error: string | null;
  login: (credentials: {
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL + '/api';

export const useDeveloperAuthStore = create<DeveloperAuthState>()(
  persist(
    (set) => ({
      developer: null,
      token: null,
      error: null,
      login: async (credentials) => {
        try {
          const response = await fetch(`${API_URL}/auth/developer/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error('Server returned non-JSON response. Please check if the server is running.');
          }

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          const userData = data.data?.user;
          const token = data.token;

          if (!userData || !token) {
            throw new Error('Invalid response format from server');
          }

          set({
            developer: userData,
            token: token,
            error: null
          });

          localStorage.setItem('developer-auth-storage', JSON.stringify({
            state: {
              developer: userData,
              token: token
            }
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Network error occurred',
            developer: null,
            token: null
          });
          throw error;
        }
      },
      logout: () => {
        set({ developer: null, token: null, error: null });
        localStorage.removeItem('developer-auth-storage');
      },
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'developer-auth-storage',
      partialize: (state) => ({
        developer: state.developer,
        token: state.token
      })
    }
  )
)
