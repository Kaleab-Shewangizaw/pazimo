import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEventStore } from './eventStore'

interface OrganizerAuthState {
  token: string | null
  organizer: {
    _id: string
    name: string
    email: string
  } | null
  isAuthenticated: boolean
  setToken: (token: string | null) => void
  setOrganizer: (organizer: { _id: string; name: string; email: string } | null) => void
  logout: () => void
}

export const useOrganizerAuthStore = create<OrganizerAuthState>()(
  persist(
    (set) => ({
      token: null,
      organizer: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setOrganizer: (organizer) => set({ organizer }),
      logout: () => {
        set({ token: null, organizer: null, isAuthenticated: false });
        useEventStore.getState().clearEvents();
        localStorage.clear();
        window.location.reload();
      },
    }),
    {
      name: 'organizer-auth',
    }
  )
) 