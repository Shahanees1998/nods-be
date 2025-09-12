import dotenv from 'dotenv'
import prisma from '../lib/prismadb.js'

dotenv.config()

export const generateOTP = () => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const otpExpires = new Date()
  otpExpires.setMinutes(otpExpires.getMinutes() + 10)
  return { otp, otpExpires }
}

// Adjusted verifyOTP function
export const verifyOTP = async (email, otp) => {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('User not found')
  }

  const isOtpExpired = new Date() > new Date(user.otpExpires)
  if (!isOtpExpired && user.otp === otp) {
    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpires: null, isVerified: true }
    })
    return { isValid: true, userId: user.id, user }
  } else {
    return { isValid: false }
  }
}
