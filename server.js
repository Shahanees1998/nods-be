import express from 'express'
import dotenv from 'dotenv'
import morgan from 'morgan'
import authRoute from './routes/auth.route.js'
import userRoute from './routes/user.route.js'
import uploadRoute from './routes/upload.route.js'
import stripeRoute from './routes/stripe.route.js'
import groupRoute from './routes/group.route.js'

// App Configuration
const app = express()
dotenv.config()

// JSON Format
app.use(express.json())

// API Request Response Logger
app.use(morgan('tiny'))

// Image / File Upload Path
app.use('/uploads', express.static('./uploads'))

// APis
app.use('/api/auth', authRoute)
app.use('/api/user', userRoute)
app.use('/api/upload', uploadRoute)
app.use('/api/stripe', stripeRoute)
app.use('/api/groups', groupRoute)

// base path to test server /
app.use('/test-nods', async (req, res) => {
  res.status(200).json({ message: 'backend is working by saad' })
})

// Port and Connection
app.listen(process.env.PORT || 8800, () => {
  console.log('Backend server is running on port:', process.env.PORT)
})
