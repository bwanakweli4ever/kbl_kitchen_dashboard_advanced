# 🍳 KBL Bites Kitchen Dashboard

A modern, real-time kitchen dashboard for managing orders, customers, and notifications.

## ✨ Features

### 🔔 Enhanced Sound Notifications
- **Fallback Audio System**: Uses Web Audio API when sound files are unavailable
- **Volume Control**: Adjustable notification volume (0-100%)
- **Sound Settings**: Toggle sound notifications on/off
- **Test Sound Button**: Verify audio functionality
- **Graceful Degradation**: Handles missing audio files gracefully

### 📋 Improved Order Management
- **Enhanced Status Flow**: 
  - Received → Acknowledged → Preparing → Ready → Out for Delivery → Delivered
- **Cancellation Support**: Cancel orders with reason tracking
- **Status Validation**: Prevents invalid status transitions
- **Quick Actions**: One-click status updates with visual feedback

### 🎨 Better User Experience
- **Real-time Updates**: Live order polling with smooth transitions
- **Responsive Design**: Works on desktop and mobile devices
- **Visual Status Indicators**: Color-coded status badges with icons
- **Order Categorization**: Ingredients organized by type (proteins, vegetables, others)

### 📊 Analytics & Monitoring
- **Live Statistics**: Real-time order counts and revenue
- **Performance Metrics**: Daily analytics and trends
- **Order Breakdown**: Status distribution and customer insights

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm or npm
- API key from KBL Bites backend

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd KBL-kitchen-dashboard

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your API configuration

# Run development server
pnpm dev
```

### Environment Variables
```bash
WHATSAPP_API_URL=http://backend.kblbites.com
# or
WHATSAPP_API_URL=http://localhost:8000
```

## 🔧 Configuration

### Sound Notifications
1. Place your notification sound file at `public/sounds/notification.wav`
2. Or use the built-in fallback audio system
3. Adjust volume and toggle sound in the notification center

### Order Status Flow
The dashboard supports the following order statuses:
- **Received**: New order received
- **Acknowledged**: Order confirmed by kitchen
- **Preparing**: Kitchen is working on the order
- **Ready**: Order is ready for pickup/delivery
- **Out for Delivery**: Order is being delivered
- **Delivered**: Order completed successfully
- **Cancelled**: Order cancelled (with reason tracking)

## 📱 Usage

### Managing Orders
1. **View Orders**: See all active orders in real-time
2. **Update Status**: Use the status dialog or quick action buttons
3. **Cancel Orders**: Cancel with reason tracking
4. **Track Progress**: Monitor order flow through the kitchen

### Notifications
1. **Sound Alerts**: Hear notifications for new orders/messages
2. **Volume Control**: Adjust notification volume
3. **Browser Notifications**: Desktop notifications (requires permission)
4. **Test Sounds**: Verify audio functionality

### Analytics
1. **Daily Stats**: View order counts, revenue, and customer data
2. **Real-time Updates**: Live data refresh
3. **Performance Metrics**: Track kitchen efficiency

## 🛠️ Technical Details

### Architecture
- **Frontend**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks with custom hooks
- **Real-time**: Polling-based updates with configurable intervals

### Key Components
- `useNotifications`: Sound and notification management
- `useRealTimeOrders`: Live order updates
- `OrderStatusDialog`: Status management with validation
- `NotificationCenter`: Sound settings and notification display

### Audio System
- **Primary**: HTML5 Audio API with fallback to Web Audio API
- **Fallback**: Programmatically generated sine wave tones
- **Error Handling**: Graceful degradation when audio fails

## 🔒 Security

- API key authentication required
- Rate limiting on API requests
- Secure token storage in localStorage
- CORS protection on API endpoints

## 📈 Performance

- Optimized re-renders with React hooks
- Efficient order filtering and updates
- Background polling with configurable intervals
- Smooth animations and transitions

## 🐛 Troubleshooting

### Sound Notifications Not Working
1. Check browser permissions for notifications
2. Verify sound file exists at `public/sounds/notification.wav`
3. Use the test sound button in notification settings
4. Check browser console for audio errors

### Orders Not Updating
1. Verify API key is correct
2. Check network connectivity
3. Review API endpoint configuration
4. Check browser console for errors

### Performance Issues
1. Reduce polling interval in `useRealTimeOrders`
2. Limit order display count
3. Check for memory leaks in browser dev tools

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review browser console for errors
- Contact the development team

---

**Built with ❤️ for KBL Bites Kitchen Team**


# kbl_kitchen_dashboard_advanced
