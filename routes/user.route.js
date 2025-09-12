import express from 'express'
import { verifyToken } from '../middleware/jwt.js'
import { changeUsername, contactUs, deleteUser, getAllChats, getMessage, sendMessage, sendMessageToGroup, updatePassword, verifyReceipt } from '../controllers/user.controller.js'

const router = express.Router()

router.use(verifyToken)

// Messaging routes
router.post('/send-message', sendMessage)
router.post('/send-message-to-group', sendMessageToGroup)
router.get('/chats', getAllChats)
router.get('/message/:phoneNumber', getMessage)
router.post('/verify-receipt', verifyReceipt)

// Profile management
router.put('/profile/change-username', changeUsername)
router.put('/profile/update-password', updatePassword)
router.delete('/profile/delete', deleteUser)

// Contact us
router.post('/contact-us', contactUs)
export default router
