import axios from 'axios'

export function getApiErrorMessage(error: unknown, fallback: string) {
  return axios.isAxiosError(error) ? error.response?.data?.error?.message ?? fallback : fallback
}
