import nodemailer from 'nodemailer'

// Email configuration (using a generic SMTP for demonstration)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'abhiawan1227@gmail.com',
    pass: 'khznerbjugdsrquw '
  }
})

// Function to send OTP
export const sendOTPEmail = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: 'nods <abhiawan1227@gmail.com>',
      to: email,
      subject: 'Your Nods OTP',
      text: `Your OTP is: ${otp}`,
      html: `<b>Your OTP is: ${otp}</b>`
    })

    console.log('Email sent successfully')
  } catch (error) {
    console.error('Error sending email:', error)
  }
}
