import prisma from '../lib/prismadb.js'

// Create a new group
export const createGroup = async (req, res) => {
  const { userId } = req
  const { name, description, contacts } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Group name is required' })
  }

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ message: 'At least one contact is required' })
  }

  try {
    // Create the group
    const group = await prisma.group.create({
      data: {
        userId,
        name,
        description: description || ''
      }
    })

    // Add contacts to the group
    const groupContacts = contacts.map(contact => ({
      groupId: group.id,
      name: contact.name,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      phone: contact.phone,
      email: contact.email || '',
      company: contact.company || '',
      website: contact.website || ''
    }))

    await prisma.groupContact.createMany({
      data: groupContacts
    })

    // Fetch the complete group with contacts
    const completeGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        contacts: true
      }
    })

    res.status(201).json({
      message: 'Group created successfully',
      group: completeGroup
    })
  } catch (error) {
    console.error('Failed to create group:', error)
    res.status(500).json({ message: 'Failed to create group', error: error.message })
  }
}

// Get all groups for a user
export const getUserGroups = async (req, res) => {
  const { userId } = req

  try {
    const groups = await prisma.group.findMany({
      where: { userId },
      include: {
        contacts: true
      },
      orderBy: { createdOn: 'desc' }
    })

    res.status(200).json({ groups })
  } catch (error) {
    console.error('Failed to fetch groups:', error)
    res.status(500).json({ message: 'Failed to fetch groups', error: error.message })
  }
}

// Get a specific group
export const getGroup = async (req, res) => {
  const { userId } = req
  const { groupId } = req.params

  try {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      },
      include: {
        contacts: true
      }
    })

    if (!group) {
      return res.status(404).json({ message: 'Group not found' })
    }

    res.status(200).json({ group })
  } catch (error) {
    console.error('Failed to fetch group:', error)
    res.status(500).json({ message: 'Failed to fetch group', error: error.message })
  }
}

// Update group details
export const updateGroup = async (req, res) => {
  const { userId } = req
  const { groupId } = req.params
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ message: 'Group name is required' })
  }

  try {
    // Check if group belongs to user
    const existingGroup = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { name, description },
      include: {
        contacts: true
      }
    })

    res.status(200).json({
      message: 'Group updated successfully',
      group: updatedGroup
    })
  } catch (error) {
    console.error('Failed to update group:', error)
    res.status(500).json({ message: 'Failed to update group', error: error.message })
  }
}

// Delete a group
export const deleteGroup = async (req, res) => {
  const { userId } = req
  const { groupId } = req.params

  try {
    // Check if group belongs to user
    const existingGroup = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    // Delete group contacts first (due to foreign key constraint)
    await prisma.groupContact.deleteMany({
      where: { groupId }
    })

    // Delete the group
    await prisma.group.delete({
      where: { id: groupId }
    })

    res.status(200).json({ message: 'Group deleted successfully' })
  } catch (error) {
    console.error('Failed to delete group:', error)
    res.status(500).json({ message: 'Failed to delete group', error: error.message })
  }
}

// Add contacts to group
export const addContactsToGroup = async (req, res) => {
  const { userId } = req
  const { groupId } = req.params
  const { contacts } = req.body

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ message: 'At least one contact is required' })
  }

  try {
    // Check if group belongs to user
    const existingGroup = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    // Prepare contacts data
    const groupContacts = contacts.map(contact => ({
      groupId,
      name: contact.name,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      phone: contact.phone,
      email: contact.email || '',
      company: contact.company || '',
      website: contact.website || ''
    }))

    // Use upsert to handle duplicate phone numbers
    const addedContacts = []
    for (const contact of groupContacts) {
      try {
        const newContact = await prisma.groupContact.create({
          data: contact
        })
        addedContacts.push(newContact)
      } catch (error) {
        // Skip duplicate contacts (unique constraint on groupId + phone)
        console.log(`Contact with phone ${contact.phone} already exists in group`)
      }
    }

    res.status(200).json({
      message: `${addedContacts.length} contacts added to group successfully`,
      addedContacts
    })
  } catch (error) {
    console.error('Failed to add contacts to group:', error)
    res.status(500).json({ message: 'Failed to add contacts to group', error: error.message })
  }
}

// Remove contact from group
export const removeContactFromGroup = async (req, res) => {
  const { userId } = req
  const { groupId, contactId } = req.params

  try {
    // Check if group belongs to user
    const existingGroup = await prisma.group.findFirst({
      where: {
        id: groupId,
        userId
      }
    })

    if (!existingGroup) {
      return res.status(404).json({ message: 'Group not found' })
    }

    // Remove the contact
    const deletedContact = await prisma.groupContact.delete({
      where: { id: contactId }
    })

    res.status(200).json({
      message: 'Contact removed from group successfully',
      deletedContact
    })
  } catch (error) {
    console.error('Failed to remove contact from group:', error)
    res.status(500).json({ message: 'Failed to remove contact from group', error: error.message })
  }
}
