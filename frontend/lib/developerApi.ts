import { useDeveloperAuthStore } from "@/store/developerAuthStore"

const API_URL = process.env.NEXT_PUBLIC_API_URL + '/api'

export const developerApi = {
  get: async (endpoint: string) => {
    const { token } = useDeveloperAuthStore.getState()
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.json()
  },
}
