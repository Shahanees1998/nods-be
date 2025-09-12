import express from 'express'
import { verifyToken } from '../middleware/jwt.js'
import { 
  createGroup,
  getUserGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addContactsToGroup,
  removeContactFromGroup
} from '../controllers/group.controller.js'

const router = express.Router()

// Apply authentication middleware to all routes
router.use(verifyToken)

// Group CRUD operations
router.post('/', createGroup)
router.get('/', getUserGroups)
router.get('/:groupId', getGroup)
router.put('/:groupId', updateGroup)
router.delete('/:groupId', deleteGroup)

// Contact management within groups
router.post('/:groupId/contacts', addContactsToGroup)
router.delete('/:groupId/contacts/:contactId', removeContactFromGroup)

export default router
