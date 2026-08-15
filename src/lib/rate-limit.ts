import 'server-only'

import { createHash } from 'node:crypto'

/**
 * In-process sliding-window rate limiter.
 *
 * Deliberately simple: at 1,000–10,000 orders this store handles the spam
 * volume a Moroccan COD landing page actually sees. It is per-instance, so on a
 * multi-instance deployment it is a first line of defence rather than a hard
 * guarantee — the real duplicate protection is the unique `idempotency_key`
 * column plus the recent-order check in the orders route, both of which live in
 * the database and hold across instances.
 */

interface Bucket {
  hits: number[]
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

const SWEEP_INTERVAL_MS = 5 * 60 * 1000

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now, windowMs)

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const oldest = bucket.hits[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)

  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 }
}

/** Best-effort client IP behind Vercel / a reverse proxy. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown'
}

/**
 * IPs are personal data, so only a salted hash is ever stored. It stays useful
 * for spotting one machine placing twenty orders without retaining the address.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? 'eps-default-salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}
