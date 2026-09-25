/**
 * Handover, Barcode & QR Code Utility Module
 * Provides deterministic 6-digit OTP generation, Code-128 linear barcode formatting,
 * QR payload formatting, and multi-format barcode scanner parsing for AaharSetu food rescues.
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

/**
 * Generates a standard Code-128 1D Barcode string value.
 * Format: AS-<DONATION_SUBSTR>-<STAGE_CODE>-<OTP>
 * Example: AS-D98FA120-P-482910 (P for pickup, D for delivery)
 */
export function generateBarcodeValue(
  donationId: string,
  stage: 'pickup' | 'delivery'
): string {
  const otp = generateHandoverOtp(donationId, stage)
  const shortId = donationId.replace(/^d-/, '').slice(0, 8).toUpperCase()
  const stageCode = stage === 'pickup' ? 'P' : 'D'
  return `AS-${shortId}-${stageCode}-${otp}`
}

export interface HandoverPayload {
  protocol: 'aaharsetu'
  version: '1.0'
  donation_id: string
  stage: 'pickup' | 'delivery'
  code: string
  item?: string
  batch?: string
  barcode?: string
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
  const barcode = generateBarcodeValue(donation.id, stage)
  const payload: HandoverPayload = {
    protocol: 'aaharsetu',
    version: '1.0',
    donation_id: donation.id,
    stage,
    code: otp,
    item: donation.item,
    batch: batchId ?? `AS-BLR-${donation.id.slice(0, 8).toUpperCase()}`,
    barcode,
    timestamp: Date.now(),
  }
  return JSON.stringify(payload)
}

export interface ParsedScanResult {
  code: string
  donationId?: string
  batchId?: string
  stage?: 'pickup' | 'delivery'
  rawText: string
}

/**
 * Parses raw decoded text from any 1D barcode reader (Code 128, Code 39, EAN, UPC)
 * or 2D QR scanner.
 * Handles structured JSON payloads, formatted barcodes (AS-XXXX-P-123456),
 * custom URI schemes, or plain 6-digit numbers.
 */
export function parseHandoverScan(rawText: string): ParsedScanResult | null {
  if (!rawText || typeof rawText !== 'string') return null
  const trimmed = rawText.trim()

  // 1. Try parsing JSON payload (standard AaharSetu QR)
  try {
    const data = JSON.parse(trimmed)
    if (data && typeof data === 'object') {
      const code = String(data.code || data.otp || '').trim()
      if (code) {
        return {
          code,
          donationId: data.donation_id || data.donationId,
          batchId: data.batch,
          stage: data.stage === 'pickup' || data.stage === 'delivery' ? data.stage : undefined,
          rawText: trimmed,
        }
      }
    }
  } catch {
    // Not JSON, continue to barcode parsers
  }

  // 2. AaharSetu 1D Barcode format: AS-<DONATION_PART>-<STAGE>-<OTP>
  // e.g. AS-D98FA120-P-482910 or AS-BLR-D98FA120-482910
  const barcodePattern = /^AS-([A-Z0-9]+)-(?:([PD])-)?(\d{6})$/i
  const barcodeMatch = trimmed.match(barcodePattern)
  if (barcodeMatch) {
    const donationPart = barcodeMatch[1]
    const stageLetter = barcodeMatch[2]?.toUpperCase()
    const otp = barcodeMatch[3]
    return {
      code: otp,
      donationId: donationPart.toLowerCase().startsWith('d-') ? donationPart.toLowerCase() : `d-${donationPart.toLowerCase()}`,
      stage: stageLetter === 'P' ? 'pickup' : stageLetter === 'D' ? 'delivery' : undefined,
      rawText: trimmed,
    }
  }

  // 3. Try parsing URL/URI parameters: aaharsetu://handover?id=...&code=123456 or https://...?code=123456
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
          rawText: trimmed,
        }
      }
    } catch {
      // ignore URL parse errors
    }
  }

  // 4. Plain 6-digit numeric OTP regex match
  const match = trimmed.match(/\b\d{6}\b/)
  if (match) {
    return {
      code: match[0],
      rawText: trimmed,
    }
  }

  // 5. Fallback: if alphanumeric code between 4 and 10 chars
  if (/^[A-Za-z0-9]{4,10}$/.test(trimmed)) {
    return {
      code: trimmed,
      rawText: trimmed,
    }
  }

  return null
}
