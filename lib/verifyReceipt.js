import axios from 'axios'
import dotenv from 'dotenv'
import { google } from 'googleapis'
import fs from 'fs'
// const serviceAccount = require('./nods-430721-9ca09fc958f4.json');
// import serviceAccount from './nods-430721-9ca09fc958f4.json'
import serviceAccount from "./nods-430721-9ca09fc958f4.json" assert { type: "json" };

dotenv.config()

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET
const APPLE_RECEIPT_URL = 'https://buy.itunes.apple.com/verifyReceipt'
const APPLE_SANDBOX_RECEIPT_URL = 'https://sandbox.itunes.apple.com/verifyReceipt'

// const serviceAccount = JSON.parse(fs.readFileSync('./nods-430721-9ca09fc958f4.json', 'utf8'))
const GOOGLE_CLIENT_EMAIL = serviceAccount.client_email
const GOOGLE_PRIVATE_KEY = serviceAccount.private_key.replace(/\\n/g, '\n') // Ensure the key formatiscorrect

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
