import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'partner';
}

interface AdminAuthState {
  admin: AdminUser | null;
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

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      admin: null,
      token: null,
      error: null,
      login: async (credentials) => {
        try {
          // console.log('Attempting admin login to:', `${API_URL}/auth/admin/login`);
          
          const response = await fetch(`${API_URL}/auth/admin/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(credentials),
          });

          // Log response status and headers
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
          // console.log('Admin login response:', data);

          if (!response.ok) {
            throw new Error(data.message || 'Login failed');
          }

          // Check if we have the user data in the expected format
          const userData = data.data?.user;
          const token = data.token;

          if (!userData || !token) {
            // console.error('Invalid response structure:', data);
            throw new Error('Invalid response format from server');
          }

          set({ 
            admin: userData,
            token: token,
            error: null
          });

          // Store in localStorage for persistence
          localStorage.setItem('admin-auth-storage', JSON.stringify({
            state: {
              admin: userData,
              token: token
            }
          }));
        } catch (error) {
          // console.error('Admin login error:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Network error occurred',
            admin: null,
            token: null
          });
          throw error;
        }
      },
      logout: () => {
        set({ admin: null, token: null, error: null });
        localStorage.removeItem('admin-auth-storage');
      },
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        admin: state.admin,
        token: state.token
      })
    }
  )
) 