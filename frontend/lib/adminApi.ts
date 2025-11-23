import { useAdminAuthStore } from "@/store/adminAuthStore"

const API_URL = process.env.NEXT_PUBLIC_API_URL + '/api'

export const adminApi = {
  get: async (endpoint: string) => {
    const { token } = useAdminAuthStore.getState()
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.json()
  },

  post: async (endpoint: string, data: any) => {
    const { token } = useAdminAuthStore.getState()
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    return response.json()
  },
} 