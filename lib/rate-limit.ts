import { prisma } from "@/lib/prisma";

/**
 * Simple in-memory rate limiter for development.
 * In production, replace with Upstash Redis or similar.
 */

const counters = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= limit) {
    return false; // blocked
  }

  entry.count++;
  return true;
}

/** Check if a user has exceeded their daily issue report limit (5/day) */
export async function checkDailyIssueLimit(userId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.issue.count({
    where: {
      reporterId: userId,
      createdAt: { gte: today },
      isPersonal: false,
    },
  });

  return count < 5;
}

/** API-level rate limit: 20 requests per minute per IP */
export function checkApiRateLimit(ip: string): boolean {
  return rateLimit(`api:${ip}`, 20, 60 * 1000);
}
