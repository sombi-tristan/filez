import bcrypt from 'bcryptjs'

export async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10)
}

export async function checkPin(pin, hash) {
  if (!hash) return false
  return bcrypt.compare(String(pin), hash)
}
