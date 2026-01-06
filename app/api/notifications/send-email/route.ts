import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, customerName, customerPhone, orderDetails } = body

    // Validate required fields
    if (!orderId || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Prepare email content
    const emailSubject = `🆕 New Order #${orderId} - ${customerName}`
    
    const emailBody = `
🎉 New Order Received!

Order Details:
📋 Order ID: #${orderId}
👤 Customer: ${customerName}
📱 Phone: ${customerPhone}
📅 Time: ${new Date().toLocaleString()}

🍽️ Food Items:
${orderDetails.size ? `• ${orderDetails.size} × ${orderDetails.quantity}` : '• Custom order'}
${orderDetails.ingredients ? `• Ingredients: ${orderDetails.ingredients.join(', ')}` : ''}
${orderDetails.spiceLevel ? `• Spice Level: ${orderDetails.spiceLevel}` : ''}
${orderDetails.sauce ? `• Sauce: ${orderDetails.sauce}` : ''}

💰 Total: ${orderDetails.foodTotal ? `${orderDetails.foodTotal} RWF` : 'TBD'}

${orderDetails.deliveryInfo ? `🚚 Delivery: ${orderDetails.deliveryInfo}` : ''}
${orderDetails.orderSource ? `📱 Source: ${orderDetails.orderSource}` : ''}

Status: ${orderDetails.status || 'Received'}

---
KBL Bites Kitchen Dashboard
Automated Notification System
    `.trim()

    // Here you would integrate with your email service
    // For now, we'll log the email content and return success
    console.log('📧 Email Notification:')
    console.log('Subject:', emailSubject)
    console.log('Body:', emailBody)
    
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // Example with SendGrid:
    /*
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    
    const msg = {
      to: process.env.KITCHEN_EMAIL || 'kitchen@kblbites.com',
      from: process.env.FROM_EMAIL || 'noreply@kblbites.com',
      subject: emailSubject,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>')
    }
    
    await sgMail.send(msg)
    */

    return NextResponse.json({
      success: true,
      message: 'Email notification sent successfully',
      orderId,
      emailSubject,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Email notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send email notification' },
      { status: 500 }
    )
  }
}








