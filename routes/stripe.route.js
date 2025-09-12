// routes/stripe.route.js
import express from 'express'
import {
  saveCardAndCreateCustomer,
  setDefaultPayment,
  subscribeToPlan,
  deleteCard,
  fetchAndSaveProducts,
  getProductsAndPrices,
  getUserSubscriptions,
  getUserCards
} from '../controllers/stripe.controller.js'
import { verifyToken } from '../middleware/jwt.js'

const router = express.Router()

router.post('/save-card', verifyToken, saveCardAndCreateCustomer)
router.get('/cards', verifyToken, getUserCards)
router.post('/set-default-payment-method', verifyToken, setDefaultPayment)

router.post('/fetch-and-save-products', fetchAndSaveProducts)
router.get('/products', verifyToken, getProductsAndPrices)

router.post('/subscribe', verifyToken, subscribeToPlan)
router.get('/subscriptions', verifyToken, getUserSubscriptions)

router.delete('/delete-card/:cardId', verifyToken, deleteCard)

export default router
