# VNPay Webhook System Overview

## 📋 System Architecture

The VNPay webhook system is a comprehensive, production-ready payment processing solution with enterprise-grade monitoring, alerting, and administrative capabilities.

## 🚀 Key Features

### Core Webhook Processing

- ✅ HMAC SHA-512 signature verification
- ✅ Idempotency protection against duplicate processing
- ✅ Automatic payment status updates
- ✅ Integration with notification and email systems
- ✅ Comprehensive error handling and logging

### Advanced Monitoring & Alerting

- ✅ Real-time webhook event tracking
- ✅ Performance metrics and analytics
- ✅ Multi-channel alerting (Email, Slack, Telegram)
- ✅ Automated health checks and status monitoring
- ✅ Database persistence with audit trails

### Administrative Dashboard

- ✅ Web-based monitoring dashboard
- ✅ Interactive performance charts and analytics
- ✅ Alert configuration management
- ✅ Data export capabilities (CSV/JSON)
- ✅ Manual system maintenance tools

### Production Features

- ✅ Automated data cleanup and retention
- ✅ Background job processing
- ✅ Load balancer support
- ✅ SSL/HTTPS configuration
- ✅ Rate limiting and security measures

## 📁 File Structure

### Core Implementation Files

```
src/
├── order/payments/
│   ├── controllers/
│   │   ├── vnpay-webhook.controller.ts         # Main webhook endpoint
│   │   └── vnpay-webhook.controller.spec.ts    # Unit tests
│   ├── services/
│   │   ├── payments.service.ts                 # Enhanced with notifications
│   │   ├── webhook-monitoring.service.ts       # Monitoring & metrics
│   │   ├── webhook-monitoring.service.spec.ts  # Unit tests
│   │   └── webhook-alert.service.ts             # Multi-channel alerts
│   ├── entities/
│   │   └── webhook-event.entity.ts             # Database entity
│   └── payments.module.ts                      # Enhanced module
├── order/controllers/
│   └── webhook-dashboard.controller.ts         # Admin dashboard API
├── common/services/
│   └── webhook-cleanup.service.ts              # Automated maintenance
└── database/migrations/
    └── 1733677200000-CreateWebhookEventsTable.ts # Database setup
```

### Testing & Documentation

```
docs/
├── frontend-development-guide.md               # Updated with webhook system
├── webhook-testing-guide.md                    # Comprehensive testing procedures
├── webhook-production-deployment.md            # Production deployment guide
├── webhook-system-overview.md                  # This overview document
└── HOW-TO-USE-VNPAY-WEBHOOK.md                # Usage guide

test/
└── vnpay-webhook.e2e-spec.ts                  # End-to-end integration tests
```

### Utility Scripts

```
scripts/
├── test-webhook.js                             # Advanced webhook testing
├── test-webhook.bat                            # Windows batch testing
├── vnpay-webhook-demo.js                       # Demo webhook scenarios
├── test-email.js                               # Email notification testing
├── health-check.js                             # System health verification
└── run-migrations.js                           # Database migration helper
```

### Configuration Files

```
├── README.md                                   # Enhanced with webhook features
├── .env.example                                # Complete environment variables
└── app.module.ts                               # Updated with ScheduleModule
```

## 🔧 Quick Start

### 1. Database Setup

```bash
# Run webhook events migration
npm run migration:run

# Verify migration
npm run migration:show
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Configure webhook settings in .env
VNPAY_IPN_URL=https://yourdomain.com/webhooks/vnpay/ipn
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=admin@example.com
```

### 3. Start the Application

```bash
# Start in development mode
npm run start:dev

# Start in production mode
npm run start:prod
```

### 4. Test Webhook Functionality

```bash
# Run automated tests
npm run test:webhook

# Test specific scenarios
node scripts/test-webhook.js
scripts/test-webhook.bat

# Check system health
node scripts/health-check.js
```

## 📊 Monitoring Endpoints

### Health & Status

- `GET /webhooks/health` - System health check
- `GET /webhooks/metrics` - Performance metrics
- `GET /webhooks/events` - Event history
- `GET /webhooks/performance` - Processing analytics

### Administrative Dashboard

- `GET /dashboard/webhooks/overview` - Dashboard overview
- `GET /dashboard/webhooks/metrics` - Detailed metrics
- `POST /dashboard/webhooks/cleanup` - Manual cleanup
- `GET /dashboard/webhooks/export/csv` - Data export

## 🚨 Alert Configuration

### Email Alerts

```bash
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=admin@example.com,alerts@example.com
```

### Slack Integration

```bash
WEBHOOK_ALERTS_SLACK_ENABLED=true
WEBHOOK_ALERTS_SLACK_WEBHOOK_URL=https://hooks.slack.com/your-webhook
WEBHOOK_ALERTS_SLACK_CHANNEL=#alerts
```

### Telegram Notifications

```bash
WEBHOOK_ALERTS_TELEGRAM_ENABLED=true
WEBHOOK_ALERTS_TELEGRAM_BOT_TOKEN=your_bot_token
WEBHOOK_ALERTS_TELEGRAM_CHAT_ID=your_chat_id
```

## 🔍 Troubleshooting

### Common Issues

1. **Invalid Signature Errors**

   - Verify `VNPAY_HASH_SECRET` configuration
   - Check parameter sorting and encoding
   - Review webhook URL configuration in VNPay dashboard

2. **Database Connection Issues**

   - Verify database credentials
   - Check migration status
   - Review connection pool settings

3. **Alert Delivery Problems**
   - Test individual alert channels
   - Verify API keys and tokens
   - Check network connectivity

### Debug Commands

```bash
# Check recent webhook events
curl http://localhost:3000/webhooks/events?limit=10

# Test webhook health
curl http://localhost:3000/webhooks/health

# View system metrics
curl http://localhost:3000/webhooks/metrics

# Test alert configuration
curl -X POST http://localhost:3000/dashboard/webhooks/alerts/test
```

## 📚 Additional Resources

- [Frontend Development Guide](./frontend-development-guide.md) - Complete API documentation with webhook integration
- [Webhook Testing Guide](./webhook-testing-guide.md) - Testing procedures and best practices
- [Production Deployment Guide](./webhook-production-deployment.md) - Production setup and configuration
- [Usage Guide](./HOW-TO-USE-VNPAY-WEBHOOK.md) - Step-by-step usage instructions
- [Main README](../README.md) - Project overview and quick start

## 🏗️ Architecture Benefits

### Reliability

- Persistent event storage with audit trails
- Automatic retry mechanisms
- Comprehensive error handling
- Duplicate prevention with idempotency

### Scalability

- Efficient database indexing
- Connection pooling support
- Background job processing
- Load balancer compatibility

### Maintainability

- Comprehensive monitoring and alerting
- Automated cleanup and maintenance
- Clear separation of concerns
- Extensive test coverage

### Security

- HMAC signature verification
- Rate limiting and throttling
- IP whitelisting capabilities
- Secure credential management

This webhook system provides a robust, scalable, and maintainable solution for VNPay payment processing with enterprise-grade monitoring and administrative capabilities.
