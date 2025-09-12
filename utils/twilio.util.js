import twilio from 'twilio'
import dotenv from 'dotenv'

dotenv.config()

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = twilio(accountSid, authToken)

export const sendSMS = async (to, body) => {
  try {
    await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to
    })
    console.log(`SMS sent to ${to}`)
  } catch (error) {
    console.error(`Failed to send SMS: ${error.message}`)
    throw error
  }
}
