import prisma from '../lib/prismadb.js'
import { twilioClient } from '../lib/twilio.js'

import bcrypt from 'bcrypt'
import { getAdditionalMessagesBasedOnProduct, verifyAppleReceipt, verifyGoogleReceipt } from '../lib/verifyReceipt.js'

const replacePlaceholders = (message, replacements) => {
  return message.replace(/\[(.*?)\]/g, (_, key) => replacements[key]?.toLowerCase() || '')
}

export const deleteUser = async (req, res) => {
  const userId = req.userId

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' })
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isDeleted: true }
    })

    res.status(200).json({ message: 'User deleted successfully', user })
  } catch (error) {
    console.error('Failed to delete user:', error)
    res.status(500).json({ message: 'Failed to delete user', error: error.message })
  }
}

export const changeUsername = async (req, res) => {
  const { userId } = req
  const { newUsername } = req.body

  if (!newUsername) {
    return res.status(400).json({ message: 'New username is required' })
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username: newUsername }
    })

    res.status(200).json({ message: 'Username updated successfully', user: updatedUser })
  } catch (error) {
    console.error('Failed to update username:', error)
    res.status(500).json({ message: 'Failed to update username', error: error.message })
  }
}

export const updatePassword = async (req, res) => {
  const { userId } = req
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new passwords are required' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' })
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    })

    res.status(200).json({ message: 'Password updated successfully' })
  } catch (error) {
    console.error('Failed to update password:', error)
    res.status(500).json({ message: 'Failed to update password', error: error.message })
  }
}

// Helper function to add delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to format phone numbers
const formatPhoneNumber = (phone) => {
  // Remove any spaces, dashes, or other formatting
  const cleanPhone = phone.replace(/[\s\-()]/g, '')

  // If it starts with +, it's already international format
  if (cleanPhone.startsWith('+')) {
    return cleanPhone
  }

  // Handle Pakistani numbers starting with 03
  if (cleanPhone.startsWith('03') && cleanPhone.length === 11) {
    // Convert 03XXXXXXXXX to +923XXXXXXXXX
    return '+92' + cleanPhone.substring(1)
  }

  // Handle other Pakistani numbers starting with 3
  if (cleanPhone.startsWith('3') && cleanPhone.length === 10) {
    // Convert 3XXXXXXXXX to +923XXXXXXXXX
    return '+92' + cleanPhone
  }

  // Handle US/Canadian numbers
  if (cleanPhone.length === 10 && !cleanPhone.startsWith('0')) {
    return '+1' + cleanPhone
  }

  // If already has country code but no +
  if (cleanPhone.startsWith('92') && cleanPhone.length === 12) {
    return '+' + cleanPhone
  }

  // Return as-is if we can't determine format
  console.warn(`Unable to format phone number: ${phone}`)
  return cleanPhone
}

export const sendMessage = async (req, res) => {
  const userId = req.userId
  const { message, recipients } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (user.remainingMsgs < recipients.length) {
      return res.status(400).json({ message: 'Not enough remaining messages to send to all recipients' })
    }

    const results = []
    const failedMessages = []
    let successCount = 0

    // Send messages with rate limiting (1 message per second to avoid Twilio rate limits)
    for (let i = 0; i < recipients.length; i++) {
      const { name, firstName, lastName, phone, email, company, website } = recipients[i]

      try {
        const replacements = { name, firstName, lastName, company, email, website }
        const personalizedMessage = replacePlaceholders(message, replacements)

        // Format phone number to international format
        const formattedPhone = formatPhoneNumber(phone)
        console.log(`Sending to: ${phone} → ${formattedPhone}`)

        // Send SMS via Twilio
        await twilioClient.messages.create({
          body: personalizedMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        })

        // Save message to database
        const savedMessage = await prisma.message.create({
          data: {
            userId,
            recipientName: name,
            recipientFirstName: firstName,
            recipientLastName: lastName,
            recipientPhone: phone,
            body: personalizedMessage
          }
        })

        results.push(savedMessage)
        successCount++

        console.log(`Message sent successfully to ${formattedPhone} (${i + 1}/${recipients.length})`)
      } catch (messageError) {
        const formattedPhone = formatPhoneNumber(phone)
        console.error(`Failed to send message to ${phone} (formatted: ${formattedPhone}):`, messageError.message)

        // Provide more specific error information
        let errorMessage = messageError.message
        if (messageError.message.includes('Authenticate')) {
          errorMessage = 'Twilio authentication failed. Check: 1) Correct credentials in .env, 2) Account status, 3) International messaging enabled.'
        } else if (messageError.message.includes('permission')) {
          errorMessage = 'Twilio account permissions issue. Verify your account status and messaging capabilities.'
        } else if (messageError.message.includes('phone number') || messageError.message.includes('number')) {
          errorMessage = 'Invalid phone number format. Ensure international format (+country code).'
        } else if (messageError.message.includes('geo')) {
          errorMessage = 'Geographic permission denied. Enable international messaging in Twilio console.'
        }

        console.log('Full Twilio Error Details:', {
          message: messageError.message,
          code: messageError.code,
          status: messageError.status,
          moreInfo: messageError.moreInfo
        })
        console.log('Processed Error Message:', errorMessage)

        failedMessages.push({
          phone,
          name: name || firstName + ' ' + lastName,
          error: errorMessage
        })
      }

      // Add delay between messages (1 second) to respect Twilio rate limits
      if (i < recipients.length - 1) {
        await delay(1000)
      }
    }

    // Update user's remaining messages based on successful sends
    await prisma.user.update({
      where: { id: userId },
      data: { remainingMsgs: user.remainingMsgs - successCount }
    })

    // Prepare response
    const responseMessage = successCount === recipients.length
      ? `All ${successCount} messages sent successfully`
      : `${successCount} out of ${recipients.length} messages sent successfully`

    const responseData = {
      message: responseMessage,
      totalRequested: recipients.length,
      successCount,
      failedCount: failedMessages.length,
      latestMessages: results
    }

    // Include failed messages info if any
    if (failedMessages.length > 0) {
      responseData.failedMessages = failedMessages
    }

    res.status(200).json(responseData)
  } catch (error) {
    console.error('Failed to send messages:', error)
    res.status(500).json({ message: 'Failed to send messages', error: error.message })
  }
}

export const getAllChats = async (req, res) => {
  const userId = req.userId

  try {
    const messages = await prisma.message.findMany({
      where: {
        userId
      },
      orderBy: {
        sentAt: 'desc'
      }
    })

    const latestMessages = new Map()

    messages.forEach(message => {
      if (!latestMessages.has(message.recipientPhone) || latestMessages.get(message.recipientPhone).sentAt < message.sentAt) {
        latestMessages.set(message.recipientPhone, message)
      }
    })

    const uniqueChats = Array.from(latestMessages.values())

    res.status(200).json(uniqueChats)
  } catch (error) {
    console.error('Failed to retrieve message history:', error)
    res.status(500).json({ message: 'Failed to retrieve message history', error: error.message })
  }
}

export const getMessage = async (req, res) => {
  const userId = req.userId
  const { phoneNumber } = req.params

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Recipient Phone Number is required' })
  }

  try {
    const messages = await prisma.message.findMany({
      where: {
        userId,
        recipientPhone: phoneNumber
      },
      orderBy: {
        sentAt: 'desc'
      }
    })

    if (!messages) {
      return res.status(404).json({ message: 'Messages not found' })
    }

    res.status(200).json({ message: 'Message retrieved successfully', data: messages })
  } catch (error) {
    console.error('Failed to retrieve message:', error)
    res.status(500).json({ message: 'Failed to retrieve message', error: error.message })
  }
}

export const verifyReceipt = async (req, res) => {
  const { platform, receiptData, productId } = req.body
  const userId = req.userId

  try {
    let verificationResult

    if (platform === 'ios') {
      verificationResult = await verifyAppleReceipt(receiptData)
    } else if (platform === 'android') {
      const { packageName, purchaseToken } = receiptData
      verificationResult = await verifyGoogleReceipt(packageName, productId, purchaseToken, receiptData.orderId)
    }

    console.log('verificationResult', verificationResult)

    const additionalMessages = getAdditionalMessagesBasedOnProduct(productId?.toLowerCase())

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { remainingMsgs: { increment: additionalMessages } }
    })

    res.status(200).json({
      message: 'Payment successful and messages updated',
      user: updatedUser,
      verificationResult
    })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const contactUs = async (req, res) => {
  const { userId } = req
  const { message } = req.body

  if (!message) {
    return res.status(400).json({ message: 'Message is required' })
  }

  try {
    const contactRecord = await prisma.contactUs.create({
      data: {
        userId,
        message
      }
    })

    res.status(200).json({ message: 'Message sent to the admin successfully', data: contactRecord })
  } catch (error) {
    console.error('Failed to save message:', error)
    res.status(500).json({ message: 'Failed to send message', error: error.message })
  }
}

export const sendMessageToGroup = async (req, res) => {
  const userId = req.userId
  const { message, groupId } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Fetch the group and its contacts
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      },
      include: {
        contacts: true
      }
    })

    if (!group) {
      return res.status(404).json({ message: 'Group not found' })
    }

    const recipients = group.contacts

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'Group has no contacts' })
    }

    if (user.remainingMsgs < recipients.length) {
      return res.status(400).json({ message: 'Not enough remaining messages to send to all group members' })
    }

    const results = []
    const failedMessages = []
    let successCount = 0

    // Send messages with rate limiting (1 message per second to avoid Twilio rate limits)
    for (let i = 0; i < recipients.length; i++) {
      const { name, firstName, lastName, phone, email, company, website } = recipients[i]

      try {
        const replacements = { name, firstName, lastName, company, email, website }
        const personalizedMessage = replacePlaceholders(message, replacements)

        // Format phone number to international format
        const formattedPhone = formatPhoneNumber(phone)
        console.log(`Sending to: ${phone} → ${formattedPhone}`)

        // Send SMS via Twilio
        await twilioClient.messages.create({
          body: personalizedMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        })

        // Save message to database
        const savedMessage = await prisma.message.create({
          data: {
            userId,
            recipientName: name,
            recipientFirstName: firstName,
            recipientLastName: lastName,
            recipientPhone: phone,
            body: personalizedMessage
          }
        })

        results.push(savedMessage)
        successCount++

        console.log(`Message sent successfully to ${formattedPhone} (${i + 1}/${recipients.length})`)
      } catch (messageError) {
        const formattedPhone = formatPhoneNumber(phone)
        console.error(`Failed to send message to ${phone} (formatted: ${formattedPhone}):`, messageError.message)

        // Provide more specific error information
        let errorMessage = messageError.message
        if (messageError.message.includes('Authenticate')) {
          errorMessage = 'Twilio authentication failed. Check: 1) Correct credentials in .env, 2) Account status, 3) International messaging enabled.'
        } else if (messageError.message.includes('permission')) {
          errorMessage = 'Twilio account permissions issue. Verify your account status and messaging capabilities.'
        } else if (messageError.message.includes('phone number') || messageError.message.includes('number')) {
          errorMessage = 'Invalid phone number format. Ensure international format (+country code).'
        } else if (messageError.message.includes('geo')) {
          errorMessage = 'Geographic permission denied. Enable international messaging in Twilio console.'
        }

        failedMessages.push({
          phone,
          name: name || firstName + ' ' + lastName,
          error: errorMessage
        })
      }

      // Add delay between messages (1 second) to respect Twilio rate limits
      if (i < recipients.length - 1) {
        await delay(1000)
      }
    }

    // Update user's remaining messages based on successful sends
    await prisma.user.update({
      where: { id: userId },
      data: { remainingMsgs: user.remainingMsgs - successCount }
    })

    // Prepare response
    const responseMessage = successCount === recipients.length
      ? `All ${successCount} messages sent successfully to group "${group.name}"`
      : `${successCount} out of ${recipients.length} messages sent successfully to group "${group.name}"`

    const responseData = {
      message: responseMessage,
      groupName: group.name,
      totalRequested: recipients.length,
      successCount,
      failedCount: failedMessages.length,
      latestMessages: results
    }

    // Include failed messages info if any
    if (failedMessages.length > 0) {
      responseData.failedMessages = failedMessages
    }

    res.status(200).json(responseData)
  } catch (error) {
    console.error('Failed to send messages to group:', error)
    res.status(500).json({ message: 'Failed to send messages to group', error: error.message })
  }
}
