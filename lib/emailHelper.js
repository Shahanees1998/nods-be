import { PrismaClient, EmailStatus } from '@prisma/client'

const prisma = new PrismaClient()

export const createOrAssignSupportTicketFromEmailQueue = async () => {
  const queuedEmails = await prisma.supportEmail.findMany({
    where: { status: EmailStatus.Queued }
  })

  console.log(`Processing ${queuedEmails.length} queued emails...`)
  for (const email of queuedEmails) {
    console.log(`Processing email (ID: ${email.zmMessageId}) from queue...`)

    // if subject has a ticket id or not
    const subjectMatch = email.subject.match(/Re: ID#(\w+)/)
    let supportTicket

    if (subjectMatch) {
      const ticketId = subjectMatch[1]

      console.log('ticketId', ticketId)

      supportTicket = await prisma.supportTicket.findUnique({
        where: { id: ticketId },
        include: { user: true, admin: true }
      })
      // console.log(supportTicket)

      if (supportTicket) {
        const newMessage = await prisma.ticketMessage.create({
          data: {
            supportTicketId: ticketId,
            message: email.bodyText,
            authorId: supportTicket.user?.id || undefined
          }
        })
        // for sorting also update the lastActionDate and lastMessageid of User that sent the last message
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: {
            lastActionDate: newMessage.createdAt,
            lastMessageId: newMessage?.authorId
          }
        })

        await prisma.supportEmail.update({
          where: { id: email.id },
          data: { status: EmailStatus.Sent }
        })
      }
    }

    // if subject does not have a ticket id
    if (!supportTicket) {
      const l1SupportUsers = await prisma.user.findMany({
        where: { userType: 'L1Support' },
        orderBy: { supportTicketCount: 'asc' }
      })

      const assignedSupportUser = l1SupportUsers.length > 0 ? l1SupportUsers[0] : null

      supportTicket = await prisma.supportTicket.create({
        data: {
          adminId: assignedSupportUser !== null ? assignedSupportUser.id : undefined,
          description: email.bodyText,
          assigned: true
        }
      })

      if (assignedSupportUser) {
        await prisma.user.update({
          where: { id: assignedSupportUser.id },
          data: { supportTicketCount: { increment: 1 } }
        })
      }
    }

    await prisma.supportEmail.update({
      where: { id: email.id },
      data: { status: EmailStatus.Sent }
    })

    console.log(`Email processed and assigned to ticket ID: ${supportTicket.id}`)
  }
}
