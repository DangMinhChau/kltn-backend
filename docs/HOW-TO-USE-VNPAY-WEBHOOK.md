# How to Use VNPay Webhook System

This guide provides step-by-step instructions for using the VNPay webhook system in your e-commerce application.

## 🚀 Quick Start

### 1. Prerequisites

Before using the webhook system, ensure you have:

- ✅ Node.js 18+ installed
- ✅ PostgreSQL/MySQL database running
- ✅ VNPay merchant account with webhook configuration
- ✅ Environment variables configured

### 2. Initial Setup

#### Database Setup

```bash
# Run the webhook events migration
npm run migration:run

# Verify the migration was successful
npm run migration:show
```

#### Environment Configuration

```bash
# Copy the environment template
copy .env.example .env

# Edit .env with your VNPay credentials
VNPAY_TMN_CODE=your_terminal_code
VNPAY_HASH_SECRET=your_hash_secret
VNPAY_IPN_URL=https://yourdomain.com/webhooks/vnpay/ipn
```

### 3. Start the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## 🔧 Basic Usage

### Creating a Payment

1. **Create an Order**

```typescript
const order = await ordersService.create({
  userId: 'user123',
  items: [
    {
      productId: 'product123',
      variantId: 'variant123',
      quantity: 2,
      price: 500000,
    },
  ],
  shippingAddress: {
    // address details
  },
});
```

2. **Initiate VNPay Payment**

```typescript
const paymentUrl = await paymentsService.createVNPayPayment({
  orderId: order.id,
  amount: order.total,
  orderInfo: `Payment for order ${order.id}`,
  returnUrl: 'https://yourapp.com/payment/success',
  cancelUrl: 'https://yourapp.com/payment/cancel',
});

// Redirect user to payment URL
window.location.href = paymentUrl;
```

3. **Webhook Processing**
   The webhook will automatically:

- ✅ Verify payment signature
- ✅ Update order status
- ✅ Send notifications
- ✅ Log the event
- ✅ Trigger alerts if needed

### Monitoring Payments

#### Check Payment Status

```typescript
// Get payment by order ID
const payment = await paymentsService.findByOrderId('ORDER123');
console.log(payment.status); // 'PENDING', 'PAID', 'FAILED'

// Get webhook events for an order
const events = await webhookMonitoringService.getEventsByOrderId('ORDER123');
```

#### View Webhook Dashboard

```bash
# Access the admin dashboard
http://localhost:3000/dashboard/webhooks/overview
```

## 📊 Monitoring & Alerts

### Health Checks

#### Manual Health Check

```bash
# Check system health
curl http://localhost:3000/webhooks/health

# Response example:
{
  "status": "healthy",
  "uptime": 86400,
  "lastProcessed": "2024-12-09T10:30:00Z",
  "errorRate": 2.5
}
```

#### Automated Health Monitoring

```bash
# Run the health check script
node scripts/health-check.js
```

### Performance Metrics

#### View Real-time Metrics

```bash
# Get performance metrics
curl http://localhost:3000/webhooks/metrics

# Response example:
{
  "totalEvents": 1250,
  "successRate": 97.5,
  "averageProcessingTime": 145,
  "recentErrors": []
}
```

### Alert Configuration

#### Email Alerts

```bash
# Enable email alerts
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=admin@yourapp.com,alerts@yourapp.com

# Test email configuration
node scripts/test-email.js
```

#### Slack Integration

```bash
# Configure Slack alerts
WEBHOOK_ALERTS_SLACK_ENABLED=true
WEBHOOK_ALERTS_SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
WEBHOOK_ALERTS_SLACK_CHANNEL=#payments

# Test Slack integration
curl -X POST http://localhost:3000/dashboard/webhooks/alerts/test
```

## 🧪 Testing

### Automated Testing

```bash
# Run webhook tests
npm run test:webhook

# Run comprehensive test scenarios
node scripts/test-webhook.js

# Windows batch testing
scripts\test-webhook.bat
```

### Manual Testing

#### Test Successful Payment

```bash
node scripts/vnpay-webhook-demo.js --scenario=success
```

#### Test Failed Payment

```bash
node scripts/vnpay-webhook-demo.js --scenario=failed
```

#### Load Testing

```bash
node scripts/test-webhook.js --load-test --concurrent=10 --requests=100
```

## 📈 Administrative Tasks

### Data Export

#### Export Webhook Events

```bash
# Export to CSV
curl "http://localhost:3000/dashboard/webhooks/export/csv?startDate=2024-01-01&endDate=2024-12-31" > webhooks.csv

# Export to JSON
curl "http://localhost:3000/dashboard/webhooks/export/json?limit=1000" > webhooks.json
```

### Data Cleanup

#### Manual Cleanup

```bash
# Clean up old webhook events
curl -X POST http://localhost:3000/dashboard/webhooks/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "retentionDays": 30,
    "includeSuccessful": false
  }'
```

#### Automated Cleanup

The system automatically cleans up old data daily at 2:00 AM. You can configure this in your environment:

```bash
WEBHOOK_CLEANUP_ENABLED=true
WEBHOOK_CLEANUP_CRON=0 2 * * *  # Daily at 2 AM
WEBHOOK_RETENTION_DAYS=30
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Invalid Signature Errors

```bash
# Check your hash secret configuration
echo $VNPAY_HASH_SECRET

# Verify webhook URL in VNPay dashboard
# Ensure no trailing slashes or extra parameters
```

#### 2. Payment Not Found

```bash
# Check if order exists
curl http://localhost:3000/orders/ORDER123

# Verify order ID format matches vnp_TxnRef
```

#### 3. Database Connection Issues

```bash
# Test database connection
npm run migration:show

# Check database credentials
echo $DATABASE_URL
```

#### 4. Alert Delivery Problems

```bash
# Test email configuration
node scripts/test-email.js

# Verify Slack webhook URL
curl -X POST $WEBHOOK_ALERTS_SLACK_WEBHOOK_URL \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test message"}'
```

### Debug Commands

```bash
# View recent webhook events
curl "http://localhost:3000/webhooks/events?limit=10&status=failed"

# Check system metrics
curl http://localhost:3000/webhooks/metrics

# View performance data
curl http://localhost:3000/webhooks/performance

# Test webhook endpoint
node scripts/test-webhook.js --debug
```

### Log Analysis

#### Application Logs

```bash
# View webhook-related logs
tail -f logs/application.log | grep -i webhook

# Filter by error level
tail -f logs/error.log | grep -i "vnpay\|webhook"
```

#### Database Queries

```sql
-- Recent webhook events
SELECT * FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;

-- Failed webhook events today
SELECT * FROM webhook_events
WHERE status = 'failed'
AND created_at >= CURRENT_DATE;

-- Performance analysis
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_events,
  AVG(processing_time) as avg_processing_time,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM webhook_events
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at);
```

## 🚀 Production Deployment

### Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] SSL certificates installed
- [ ] VNPay webhook URL updated
- [ ] Alert channels tested
- [ ] Backup procedures in place
- [ ] Monitoring dashboard accessible

### Deployment Steps

1. **Deploy Application**

```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

2. **Configure Load Balancer**

```nginx
# Nginx configuration example
upstream backend {
    server localhost:3000;
    server localhost:3001;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /webhooks/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

3. **Setup Monitoring**

```bash
# Configure external monitoring
curl -X POST https://monitor.example.com/webhooks \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://yourdomain.com/webhooks/health",
    "interval": 60,
    "alertEmail": "admin@yourdomain.com"
  }'
```

### Post-deployment Verification

```bash
# Test webhook endpoint
curl -X POST https://yourdomain.com/webhooks/vnpay/ipn \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "vnp_ResponseCode=00&vnp_TxnRef=TEST123&..."

# Verify health endpoint
curl https://yourdomain.com/webhooks/health

# Check dashboard access
curl https://yourdomain.com/dashboard/webhooks/overview
```

## 📞 Support

### Documentation Resources

- [Webhook System Overview](./webhook-system-overview.md) - Complete system architecture
- [Frontend Development Guide](./frontend-development-guide.md) - API documentation
- [Testing Guide](./webhook-testing-guide.md) - Testing procedures
- [Production Deployment](./webhook-production-deployment.md) - Production setup

### Getting Help

For technical support:

1. Check the troubleshooting section above
2. Review system logs and metrics
3. Test with the provided utility scripts
4. Consult the comprehensive documentation

### Best Practices

- ✅ Always test webhook changes in staging first
- ✅ Monitor webhook performance regularly
- ✅ Keep environment variables secure
- ✅ Implement proper backup procedures
- ✅ Set up comprehensive alerting
- ✅ Review webhook events periodically
- ✅ Keep documentation updated

---

This webhook system provides enterprise-grade payment processing with comprehensive monitoring, alerting, and administrative capabilities. Follow this guide to ensure reliable and secure VNPay payment integration in your e-commerce application.
