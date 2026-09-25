/**
 * Handover & QR Code Utility Module
 * Provides deterministic 6-digit OTP generation, QR payload formatting,
 * and flexible scanner parsing for AaharSetu food rescues.
 */

import type { Donation } from '@/src/types'

const SALT = 'aaharsetu-secure-salt'

/**
 * Deterministically generates a 6-digit verification OTP based on
 * the donation ID, stage, and secure salt.
 * Interoperable with backend Python verification.
 */
export function generateHandoverOtp(donationId: string, stage: 'pickup' | 'delivery'): string {
  const str = `${donationId}:${stage}:${SALT}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return String(100000 + (Math.abs(hash) % 900000))
}

export interface HandoverPayload {
  protocol: 'aaharsetu'
  version: '1.0'
  donation_id: string
  stage: 'pickup' | 'delivery'
  code: string
  item?: string
  batch?: string
  timestamp: number
}

/**
 * Creates a structured JSON QR code payload string.
 */
export function generateHandoverPayload(
  donation: Donation,
  stage: 'pickup' | 'delivery',
  batchId?: string
): string {
  const otp = generateHandoverOtp(donation.id, stage)
  const payload: HandoverPayload = {
    protocol: 'aaharsetu',
    version: '1.0',
    donation_id: donation.id,
    stage,
    code: otp,
    item: donation.item,
    batch: batchId ?? `AS-BLR-${donation.id.slice(0, 8).toUpperCase()}`,
    timestamp: Date.now(),
  }
  return JSON.stringify(payload)
}

export interface ParsedScanResult {
  code: string
  donationId?: string
  stage?: 'pickup' | 'delivery'
}

/**
 * Parses raw decoded text from any QR scanner or barcode reader.
 * Handles structured JSON payloads, custom URI schemes, or plain 6-digit numbers.
 */
export function parseHandoverScan(rawText: string): ParsedScanResult | null {
  if (!rawText || typeof rawText !== 'string') return null
  const trimmed = rawText.trim()

  // 1. Try parsing JSON payload
  try {
    const data = JSON.parse(trimmed)
    if (data && typeof data === 'object') {
      const code = String(data.code || data.otp || '').trim()
      if (code) {
        return {
          code,
          donationId: data.donation_id || data.donationId,
          stage: data.stage === 'pickup' || data.stage === 'delivery' ? data.stage : undefined,
        }
      }
    }
  } catch {
    // Not JSON, continue to next parsers
  }

  // 2. Try parsing URL/URI parameters: aaharsetu://handover?id=...&code=123456 or https://...?code=123456
  if (trimmed.includes('?') && (trimmed.includes('code=') || trimmed.includes('otp='))) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `http://dummy.com/${trimmed}`)
      const code = url.searchParams.get('code') || url.searchParams.get('otp')
      const donationId = url.searchParams.get('donation_id') || url.searchParams.get('id')
      const stage = url.searchParams.get('stage') as 'pickup' | 'delivery' | null
      if (code) {
        return {
          code: code.trim(),
          donationId: donationId || undefined,
          stage: stage === 'pickup' || stage === 'delivery' ? stage : undefined,
        }
      }
    } catch {
      // ignore URL parse errors
    }
  }

  // 3. Plain 6-digit numeric OTP regex match
  const match = trimmed.match(/\b\d{6}\b/)
  if (match) {
    return { code: match[0] }
  }

  // Fallback: if alphanumeric code between 4 and 10 chars
  if (/^[A-Za-z0-9]{4,10}$/.test(trimmed)) {
    return { code: trimmed }
  }

  return null
}
