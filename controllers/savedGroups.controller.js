import prisma from '../lib/prismadb.js'

// Create a new saved group
export const createSavedGroup = async (req, res) => {
  console.log('🚀 CREATE_SAVED_GROUP API called')
  console.log('📝 Request body:', req.body)
  console.log('🔑 Request headers:', req.headers)
  
  const { name, description, contacts } = req.body
  // Temporarily use a default userId for testing
  const userId = req.user?.userId || 'test-user-id'
  
  console.log('👤 User ID:', userId)
  console.log('📋 Group name:', name)
  console.log('📝 Description:', description)
  console.log('👥 Contacts:', contacts)

  if (!name) {
    console.log('❌ Group name is missing')
    return res.status(400).json({ message: 'Group name is required' })
  }

  try {
    console.log('💾 Creating saved group in database...')
    const savedGroup = await prisma.savedGroup.create({
      data: {
        name,
        description,
        userId,
        contacts: {
          create: contacts?.map(contact => ({
            name: contact.name,
            phone: contact.phone,
            email: contact.email
          })) || []
        }
      },
      include: {
        contacts: true
      }
    })

    console.log('✅ Saved group created successfully:', savedGroup)
    res.status(201).json({ 
      message: 'Saved group created successfully', 
      data: savedGroup 
    })
  } catch (error) {
    console.log('❌ Error creating saved group:', error.message)
    res.status(500).json({ 
      message: 'Error creating saved group', 
      error: error.message 
    })
  }
}

// Get all saved groups for a user
export const getSavedGroups = async (req, res) => {
  console.log('🚀 GET_SAVED_GROUPS API called')
  console.log('🔑 Request headers:', req.headers)
  
  // Temporarily use a default userId for testing
  const userId = req.user?.userId || 'test-user-id'
  
  console.log('👤 User ID:', userId)

  try {
    console.log('🔍 Fetching saved groups from database...')
    const savedGroups = await prisma.savedGroup.findMany({
      where: { userId },
      include: {
        contacts: true
      },
      orderBy: {
        createdOn: 'desc'
      }
    })

    console.log('✅ Found saved groups:', savedGroups.length)
    console.log('📋 Groups data:', savedGroups)
    
    res.status(200).json({ 
      message: 'Saved groups retrieved successfully', 
      data: savedGroups 
    })
  } catch (error) {
    console.log('❌ Error retrieving saved groups:', error.message)
    res.status(500).json({ 
      message: 'Error retrieving saved groups', 
      error: error.message 
    })
  }
}

// Update a saved group
export const updateSavedGroup = async (req, res) => {
  const { id } = req.params
  const { name, description } = req.body
  const userId = req.user.userId

  if (!name) {
    return res.status(400).json({ message: 'Group name is required' })
  }

  try {
    // Verify ownership
    const existingGroup = await prisma.savedGroup.findFirst({
      where: { id, userId }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Saved group not found' })
    }

    const updatedGroup = await prisma.savedGroup.update({
      where: { id },
      data: {
        name,
        description
      },
      include: {
        contacts: true
      }
    })

    res.status(200).json({ 
      message: 'Saved group updated successfully', 
      data: updatedGroup 
    })
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating saved group', 
      error: error.message 
    })
  }
}

// Delete a saved group
export const deleteSavedGroup = async (req, res) => {
  const { id } = req.params
  const userId = req.user.userId

  try {
    // Verify ownership
    const existingGroup = await prisma.savedGroup.findFirst({
      where: { id, userId }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Saved group not found' })
    }

    // Delete the group (contacts will be deleted automatically due to cascade)
    await prisma.savedGroup.delete({
      where: { id }
    })

    res.status(200).json({ message: 'Saved group deleted successfully' })
  } catch (error) {
    res.status(500).json({ 
      message: 'Error deleting saved group', 
      error: error.message 
    })
  }
}

// Add a contact to a saved group
export const addContactToGroup = async (req, res) => {
  const { id } = req.params
  const { name, phone, email } = req.body
  const userId = req.user.userId

  if (!name || !phone) {
    return res.status(400).json({ message: 'Contact name and phone are required' })
  }

  try {
    // Verify ownership
    const existingGroup = await prisma.savedGroup.findFirst({
      where: { id, userId }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Saved group not found' })
    }

    const contact = await prisma.savedGroupContact.create({
      data: {
        savedGroupId: id,
        name,
        phone,
        email
      }
    })

    res.status(201).json({ 
      message: 'Contact added to group successfully', 
      data: contact 
    })
  } catch (error) {
    res.status(500).json({ 
      message: 'Error adding contact to group', 
      error: error.message 
    })
  }
}

// Remove a contact from a saved group
export const removeContactFromGroup = async (req, res) => {
  const { id, contactId } = req.params
  const userId = req.user.userId

  try {
    // Verify ownership
    const existingGroup = await prisma.savedGroup.findFirst({
      where: { id, userId }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Saved group not found' })
    }

    // Verify contact exists in the group
    const contact = await prisma.savedGroupContact.findFirst({
      where: { id: contactId, savedGroupId: id }
    })

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found in group' })
    }

    await prisma.savedGroupContact.delete({
      where: { id: contactId }
    })

    res.status(200).json({ message: 'Contact removed from group successfully' })
  } catch (error) {
    res.status(500).json({ 
      message: 'Error removing contact from group', 
      error: error.message 
    })
  }
}

