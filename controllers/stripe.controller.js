import prisma from '../lib/prismadb.js'
import stripe from '../lib/stripe.js'

// save card
export const saveCardAndCreateCustomer = async (req, res) => {
  const { userId } = req
  const { paymentMethodId } = req.body // Assuming `paymentMethodId` is sent from the frontend

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    let customer
    if (!user.stripeCustomerId) {
      // Create Stripe customer and attach payment method
      customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
        payment_method: paymentMethodId
      })

      // Set the default payment method for the customer
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id }
      })
    } else {
      // Retrieve existing customer
      customer = await stripe.customers.retrieve(user.stripeCustomerId)

      // Attach payment method to existing customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      })

      // Set the default payment method for the customer
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })
    }

    // Retrieve payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

    // Update all other cards to be non-default
    await prisma.card.updateMany({
      where: { userId },
      data: { isDefault: false }
    })

    // Save card details in the database
    const card = await prisma.card.create({
      data: {
        userId: user.id,
        stripeCardId: paymentMethod.id,
        last4: paymentMethod.card.last4,
        brand: paymentMethod.card.brand,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
        isDefault: true
      }
    })

    res.status(200).json({ message: 'Card saved successfully', card })
  } catch (error) {
    res.status(500).json({ message: 'Error saving card', error: error.message })
  }
}

// get card
export const getUserCards = async (req, res) => {
  const { userId } = req

  try {
    const cards = await prisma.card.findMany({
      where: { userId }
    })

    if (!cards) {
      return res.status(404).json({ message: 'No cards found for this user' })
    }

    res.status(200).json({ cards })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cards', error: error.message })
  }
}

// set default payment
export const setDefaultPayment = async (req, res) => {
  const { userId } = req
  const { cardId } = req.body

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ message: 'User not found or no Stripe customer ID' })
    }

    // Set the default payment method for the customer in Stripe
    await stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: cardId }
    })

    // Update all other cards to be non-default
    await prisma.card.updateMany({
      where: { userId },
      data: { isDefault: false }
    })

    // Set the selected card as default in the database
    const card = await prisma.card.update({
      where: { stripeCardId: cardId },
      data: { isDefault: true }
    })

    res.status(200).json({ message: 'Default payment method updated successfully', card })
  } catch (error) {
    res.status(500).json({ message: 'Error setting default payment method', error: error.message })
  }
}

// subscribe
export const subscribeToPlan = async (req, res) => {
  const { userId } = req
  const { productId } = req.body

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ message: 'User not found or no Stripe customer ID' })
    }

    // Fetch product from database
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product || !product.priceId) {
      return res.status(404).json({ message: 'Product not found or no price associated with this product' })
    }

    // Fetch default card for the user
    const card = await prisma.card.findFirst({
      where: {
        userId,
        isDefault: true
      }
    })

    if (!card) {
      return res.status(404).json({ message: 'No default card found for the user' })
    }

    // Create a Payment Intent for the one-time purchase
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(product.price * 100), // Stripe expects the amount in cents
      currency: product.currency,
      customer: user.stripeCustomerId,
      description: product.description,
      payment_method: card.stripeCardId,
      confirm: true,
      off_session: true
    })

    // Extract the number of messages from the product name
    const numberOfMessages = parseInt(product.name.split(' ')[0], 10)

    // Increment the user's remaining messages
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        remainingMsgs: user.remainingMsgs + numberOfMessages
      }
    })

    res.status(200).json({
      message: 'Payment successful and messages updated',
      paymentIntent,
      user: updatedUser
    })
  } catch (error) {
    res.status(500).json({ message: 'Error processing payment', error: error.message })
  }
}

// get plans and prices
export const fetchAndSaveProducts = async (req, res) => {
  try {
    const products = await stripe.products.list()
    const prices = await stripe.prices.list()

    const productPromises = products.data.map(async (product) => {
      const productPrices = prices.data.filter(price => price.product === product.id)

      const price = productPrices[0] // Assuming each product has one price for simplicity

      return prisma.product.upsert({
        where: { productId: product.id },
        update: {
          name: product.name,
          description: product.description,
          price: price.unit_amount / 100,
          currency: price.currency,
          priceId: price.id
        },
        create: {
          productId: product.id,
          priceId: price.id,
          name: product.name,
          description: product.description,
          price: price.unit_amount / 100,
          currency: price.currency
        }
      })
    })

    await Promise.all(productPromises)

    res.status(200).json({ message: 'Products and prices saved successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching and saving products', error: error.message })
  }
}

// Fetch products and prices from the database
export const getProductsAndPrices = async (req, res) => {
  try {
    const products = await prisma.product.findMany()
    res.status(200).json({ products })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products and prices', error: error.message })
  }
}

// Delete a card
export const deleteCard = async (req, res) => {
  const { userId } = req
  const { cardId } = req.params

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ message: 'User not found or no Stripe customer ID' })
    }

    // Detach the payment method from Stripe
    await stripe.paymentMethods.detach(cardId)

    // Check if the card to be deleted is the default card
    const defaultCard = await prisma.card.findFirst({
      where: { userId, stripeCardId: cardId, isDefault: true }
    })

    // Delete the card from the database
    await prisma.card.deleteMany({
      where: {
        userId: user.id,
        stripeCardId: cardId
      }
    })

    if (defaultCard) {
      // Get the first card of the user to set it as the default
      const newDefaultCard = await prisma.card.findFirst({
        where: { userId },
        orderBy: { createdOn: 'asc' }
      })

      if (newDefaultCard) {
        // Set the new default card in Stripe
        await stripe.customers.update(user.stripeCustomerId, {
          invoice_settings: { default_payment_method: newDefaultCard.stripeCardId }
        })

        // Update the new default card in the database
        await prisma.card.update({
          where: { id: newDefaultCard.id },
          data: { isDefault: true }
        })
      }
    }

    res.status(200).json({ message: 'Card deleted successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Error deleting card', error: error.message })
  }
}

// Fetch user subscriptions
export const getUserSubscriptions = async (req, res) => {
  const { userId } = req

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      include: {
        user: true
      }
    })

    if (!subscriptions) {
      return res.status(404).json({ message: 'No subscriptions found for this user' })
    }

    res.status(200).json({ subscriptions })
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscriptions', error: error.message })
  }
}
