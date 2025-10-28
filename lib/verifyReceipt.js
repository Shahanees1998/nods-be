import axios from 'axios'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'

dotenv.config()

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET
const APPLE_RECEIPT_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_SANDBOX_RECEIPT_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

// Load Google Cloud service account credentials
let GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY

try {
  // Try to load from JSON file first
  const serviceAccount = JSON.parse(fs.readFileSync('./lib/nods-430721-9ca09fc958f4.json', 'utf8'))
  GOOGLE_CLIENT_EMAIL = serviceAccount.client_email
  GOOGLE_PRIVATE_KEY = serviceAccount.private_key.replace(/\\n/g, '\n')
} catch (error) {
  // Fallback to environment variables
  console.log('⚠️  Google Cloud service account JSON file not found, using environment variables')
  GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL
  GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn('⚠️  Google Cloud credentials not found in environment variables. Google receipt verification will not work.')
  }
}

export const verifyAppleReceipt = async (receiptData) => {
  let response = await axios.post(APPLE_RECEIPT_URL, {
    'receipt-data': receiptData.receipt,
    password: APPLE_SHARED_SECRET
  })

  if (response.data?.status === 21007 ?? response?.data?.status_code === 21007) {
    response = await axios.post(APPLE_SANDBOX_RECEIPT_URL, {
      'receipt-data': receiptData.receipt,
      password: APPLE_SHARED_SECRET
    })
  }

  if (response?.data?.status === 0 ?? response?.data?.status_code === 0) {
    return response.data
  } else {
    throw new Error('Apple receipt verification failed')
  }
}

export const verifyGoogleReceipt = async (packageName, productId, purchaseToken, orderId) => {
  // Check if Google credentials are available
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Cloud credentials not configured. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY
    },
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  })

  const authClient = await auth.getClient()
  google.options({ auth: authClient })

  try {
    const purchaseResponse = await google.androidpublisher('v3').purchases.products.get({
      packageName,
      productId,
      token: purchaseToken
    })

    if (purchaseResponse.data.purchaseState !== 0) {
      throw new Error('Purchase is either Pending or Cancelled!')
    }
    if (purchaseResponse.data.consumptionState !== 0) {
      throw new Error('Purchase is already consumed!')
    }
    if (purchaseResponse.data.orderId !== orderId) {
      throw new Error('Invalid orderId')
    }
    return purchaseResponse
  } catch (e) {
    throw new Error(e.message)
  }
}

// Function to map productId to the number of additional messages
export const getAdditionalMessagesBasedOnProduct = (productId) => {
  switch (productId) {
    case 'com.nods.25messages':
      return 25
    case 'com.nods.50messages':
      return 50
    case 'com.nods.100messages':
      return 100
    case 'com.nods.500messages':
      return 500
    case 'com.nods.1000messages':
      return 1000
    default:
      return 0
  }
}
