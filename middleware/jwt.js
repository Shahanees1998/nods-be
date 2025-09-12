import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

export const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(403).json({ message: 'A token is required for authentication' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.phone = decoded.phone
    req.userId = decoded.userId

    next()
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Token' })
  }
}
