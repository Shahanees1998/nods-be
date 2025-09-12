import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

// Debug environment variables
console.log('Twilio Configuration Check:')
console.log('Account SID:', accountSid ? `${accountSid.substring(0, 6)}...${accountSid.substring(accountSid.length - 4)}` : 'NOT SET')
console.log('Auth Token:', authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length - 4)}` : 'NOT SET')
console.log('Phone Number:', process.env.TWILIO_PHONE_NUMBER || 'NOT SET')

if (!accountSid || !authToken) {
  console.error('❌ Twilio credentials are missing! Please check your .env file')
  console.error('Required variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER')
} else {
  console.log('✅ Twilio credentials loaded successfully!')
  console.log('ℹ️  Note: Make sure your Twilio account has international messaging enabled for non-US numbers')
}

export const twilioClient = twilio(accountSid, authToken)
