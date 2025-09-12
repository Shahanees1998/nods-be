import express from 'express'
import { register, login, verifyUserOtp, forgotPassword, resetPassword } from '../controllers/auth.controller.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/verify-otp', verifyUserOtp)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)

export default router
