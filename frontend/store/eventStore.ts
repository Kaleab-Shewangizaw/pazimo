import { create } from 'zustand'
import { toast } from 'sonner'
import { useAuthStore } from './authStore'

interface TicketType {
  name: string
  price: number
  quantity: number
  description: string
  available: boolean
}

interface Location {
  type: 'Point'
  coordinates: [number, number]
  address: string
  city: string
  country: string
}

interface Category {
  _id: string;
  name: string;
  description: string;
}

interface Event {
  _id: string
  title: string
  description: string
  category: Category
  startDate: string
  endDate: string
  location: Location
  organizer: string
  coverImage: string
  eventImages: Array<{ url: string; caption: string }>
  ticketTypes: TicketType[]
  status: 'draft' | 'published' | 'cancelled' | 'completed'
  capacity: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface EventStore {
  events: Event[]
  currentEvent: Event | null
  isLoading: boolean
  error: string | null
  fetchEvents: (userId: string) => Promise<void>
  fetchEvent: (id: string) => Promise<void>
  createEvent: (eventData: any) => Promise<void>
  updateEvent: (id: string, eventData: FormData) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  publishEvent: (id: string) => Promise<void>
  cancelEvent: (id: string) => Promise<void>
  clearEvents: () => void
}

// Make sure this matches your backend port
const API_URL = process.env.NEXT_PUBLIC_API_URL + '/api';

export const useEventStore = create<EventStore>((set, get) => ({
  events: [],
  currentEvent: null,
  isLoading: false,
  error: null,

  fetchEvents: async (userId: string) => {
    set({ isLoading: true, error: null })
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // console.log('Fetching events from:', `${API_URL}/events/organizer/${userId}`);
      // console.log('Auth token:', token);

      const response = await fetch(`${API_URL}/events/organizer/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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
      // console.log('Events response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch events');
      }

      // Handle both possible response formats
      const events = data.events || data.data || [];
      // console.log('Processed events:', events);
      
      set({ events, isLoading: false });
    } catch (error) {
      // console.error('Failed to fetch events:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to fetch events', isLoading: false });
      toast.error(error instanceof Error ? error.message : 'Failed to fetch events');
    }
  },

  fetchEvent: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated || !authState.token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_URL}/events/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        // console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check if the server is running.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch event');
      
      set({ currentEvent: data.data || data.event, isLoading: false });
    } catch (error) {
      // console.error('Failed to fetch event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to fetch event', isLoading: false });
      toast.error('Failed to fetch event');
    }
  },

  createEvent: async (eventData: any) => {
    set({ isLoading: true, error: null })
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('organizer', userId);
      
      Object.entries(eventData).forEach(([key, value]) => {
        if (key === 'ticketTypes') {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'tags' && Array.isArray(value)) {
          formData.append(key, value.join(','));
        } else {
          formData.append(key, value as string);
        }
      });

      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create event');
      }

      set(state => ({ 
        events: [data.data.event, ...state.events],
        isLoading: false 
      }));
      toast.success('Event created successfully');
      return data.data.event;
    } catch (error) {
      // console.error('Failed to create event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to create event', isLoading: false });
      toast.error(error instanceof Error ? error.message : 'Failed to create event');
      throw error;
    }
  },

  updateEvent: async (id: string, eventData: FormData) => {
    set({ isLoading: true, error: null })
    try {
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated || !authState.token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_URL}/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Accept': 'application/json',
        },
        body: eventData,
        credentials: 'include',
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check if the server is running.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update event');
      
      set(state => ({
        events: state.events.map(event => 
          event._id === id ? (data.data || data.event) : event
        ),
        currentEvent: data.data || data.event,
        isLoading: false
      }))
      toast.success('Event updated successfully')
    } catch (error) {
      console.error('Failed to update event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to update event', isLoading: false })
      toast.error(error instanceof Error ? error.message : 'Failed to update event')
    }
  },

  deleteEvent: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated || !authState.token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_URL}/events/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check if the server is running.');
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete event');
      }
      
      set(state => ({
        events: state.events.filter(event => event._id !== id),
        currentEvent: null,
        isLoading: false
      }))
      toast.success('Event deleted successfully')
    } catch (error) {
      console.error('Failed to delete event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to delete event', isLoading: false })
      toast.error(error instanceof Error ? error.message : 'Failed to delete event')
    }
  },

  publishEvent: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated || !authState.token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_URL}/events/${id}/publish`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check if the server is running.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to publish event');
      
      set(state => ({
        events: state.events.map(event => 
          event._id === id ? { ...event, status: 'published' } : event
        ),
        currentEvent: data.data || data.event,
        isLoading: false
      }))
      toast.success('Event published successfully')
    } catch (error) {
      console.error('Failed to publish event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to publish event', isLoading: false })
      toast.error(error instanceof Error ? error.message : 'Failed to publish event')
    }
  },

  cancelEvent: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const authState = useAuthStore.getState()
      if (!authState.isAuthenticated || !authState.token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch(`${API_URL}/events/${id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Please check if the server is running.');
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to cancel event');
      
      set(state => ({
        events: state.events.map(event => 
          event._id === id ? { ...event, status: 'cancelled' } : event
        ),
        currentEvent: data.data || data.event,
        isLoading: false
      }))
      toast.success('Event cancelled successfully')
    } catch (error) {
      console.error('Failed to cancel event:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to cancel event', isLoading: false })
      toast.error(error instanceof Error ? error.message : 'Failed to cancel event')
    }
  },

  clearEvents: () => {
    set({ events: [], currentEvent: null, isLoading: false, error: null });
  },
}))

export const clearEvents = () => useEventStore.getState().clearEvents(); 