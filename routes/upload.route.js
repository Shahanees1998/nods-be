import express from 'express'
import { multipleFileUpload, singleFileUpload } from '../controllers/upload.controller.js'
import upload from '../lib/fileUpload.js'

const router = express.Router()

router.post('/file', upload.single('file'), singleFileUpload)
router.post('/files', upload.array('file', 10), multipleFileUpload)

export default router
