import cloudinary from '../lib/cloudinaryConfig.js'

export const singleFileUpload = async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.')

  try {
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload_stream({ resource_type: 'auto' },
      (error, result) => {
        if (error) return res.status(500).send('Failed to upload to Cloudinary.')
        res.send({ message: 'Successfully uploaded to Cloudinary.', url: result.secure_url })
      }
    )
    result.end(req.file.buffer)
  } catch (error) {
    res.status(500).send('Server error')
  }
}

export const multipleFileUpload = async (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).send('No files uploaded.')

  try {
    // Map each file to an upload promise
    const uploadPromises = req.files.map(file =>
      new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ resource_type: 'auto' },
          (error, result) => {
            if (error) reject(error)
            else resolve(result.secure_url)
          }
        )
        uploadStream.end(file.buffer)
      })
    )
    const urls = await Promise.all(uploadPromises)

    res.json({ message: 'Files uploaded successfully', urls })
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload files', error: error.message })
  }
}
