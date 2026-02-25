import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRY = '7d'
const SALT_ROUNDS = 10

export interface JwtPayload {
  userId: string
  username: string
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string
      username?: string
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function createToken(user: { id: string; username: string }): string {
  return jwt.sign(
    { userId: user.id, username: user.username } as JwtPayload,
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  try {
    const token = authHeader.slice(7)
    const payload = verifyToken(token)
    req.userId = payload.userId
    req.username = payload.username
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
