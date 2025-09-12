import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

export const generateJwtToken = (payload) => {
  const token = jwt.sign(payload, process.env.JWT_SECRET)
  return token
}
