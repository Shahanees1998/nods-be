import prisma from '../lib/prismadb.js'
import { sendOTPEmail } from '../utils/email.util.js'
import { generateJwtToken } from '../utils/jwt.util.js'
import { generateOTP } from '../utils/otp.util.js'

import bcrypt from 'bcrypt'

export const register = async (req, res) => {
  const {
    username,
    email,
    password,
    usageType,
    // Personal use fields
    firstName,
    lastName,
    personalPhone,
    personalAddress,
    personalCity,
    personalState,
    personalPostalCode,
    personalCountry,
    // Business use fields
    businessName,
    businessAddress,
    businessCity,
    businessState,
    businessPostalCode,
    businessCountry,
    businessType,
    businessRegNumber,
    businessRegType,
    industry,
    website,
    regionsOfOperation
  } = req.body

  if (!email || !password || !username) {
    return res.status(400).json({ message: 'Email, username, and password are required' })
  }

  // Validate required fields based on usage type
  if (usageType === 'Personal') {
    if (!firstName || !lastName || !personalPhone) {
      return res.status(400).json({
        message: 'For personal use, first name, last name, and phone number are required'
      })
    }
  } else if (usageType === 'Business') {
    if (!businessName || !businessType || !industry) {
      return res.status(400).json({
        message: 'For business use, business name, business type, and industry are required'
      })
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    // Prepare user data based on usage type
    const userData = {
      username,
      email,
      password: hashedPassword,
      usageType: usageType || 'Personal'
    }

    // Add personal fields if usage type is Personal
    if (usageType === 'Personal') {
      Object.assign(userData, {
        firstName,
        lastName,
        personalPhone,
        personalAddress,
        personalCity,
        personalState,
        personalPostalCode,
        personalCountry
      })
    }

    // Add business fields if usage type is Business
    if (usageType === 'Business') {
      Object.assign(userData, {
        businessName,
        businessAddress,
        businessCity,
        businessState,
        businessPostalCode,
        businessCountry,
        businessType,
        businessRegNumber,
        businessRegType,
        industry,
        website,
        regionsOfOperation: regionsOfOperation || []
      })
    }

    const user = await prisma.user.create({
      data: userData
    })

    res.status(201).json({
      message: 'User registered successfully',
      userId: user.id,
      usageType: user.usageType
    })
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message })
  }
}

export const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (user.isDeleted) {
      return res.status(403).json({ message: 'User account is deleted' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' })
    }

    res.status(200).json({ message: 'Login successful', userId: user.id })
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message })
  }
}

export const verifyUserOtp = async (req, res) => {
  const { email, otp } = req.body

  if (!email || !otp) {
    return res.status(400).json({ message: 'email and OTP are required' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Accept any OTP — no send/verify against stored value
    await prisma.user.update({
      where: { email },
      data: { otp: null, otpExpires: null, isVerified: true }
    })

    const token = generateJwtToken({ email: user.email, userId: user.id })

    res.status(200).json({ message: 'OTP verified successfully', token, user })
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message })
  }
}

export const forgotPassword = async (req, res) => {
  const { email } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email is required' })
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const { otp, otpExpires } = generateOTP()

    await prisma.user.update({
      where: { email },
      data: { otp, otpExpires }
    })

    await sendOTPEmail(email, otp)

    res.json({ message: 'OTP sent to email successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error on sending OTP', error: error.message })
  }
}

export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body

  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email, and new password are required' })
  }

  try {
    await prisma.user.findUnique({ where: { email } })

    // if (!user || user.otp !== otp || user.otpExpires < new Date()) {
    //   return res.status(400).json({ message: 'Invalid or expired OTP' })
    // }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })

    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message })
  }
}
