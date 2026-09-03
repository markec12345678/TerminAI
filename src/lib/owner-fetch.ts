'use client'

/**
 * Pošiljanje zahtevkov z lastniškim PIN-om (sessionStorage).
 * Uporablja se v vseh lastniških komponentah — PIN se pošlje
 * kot glava x-owner-pin na občutljivih poteh.
 */

export function getStoredPin(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem('terminai_pin')
}

export function setStoredPin(pin: string) {
  sessionStorage.setItem('terminai_pin', pin)
}

export function clearStoredPin() {
  sessionStorage.removeItem('terminai_pin')
}

export async function ownerFetch(url: string, init?: RequestInit): Promise<Response> {
  const pin = getStoredPin()
  const headers = new Headers(init?.headers)
  if (pin) headers.set('x-owner-pin', pin)
  return fetch(url, { ...init, headers })
}
