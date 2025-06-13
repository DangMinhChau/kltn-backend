# Quick Setup Guide - VNPay Webhook System

This guide helps developers quickly set up the VNPay webhook system in the e-commerce backend.

## Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ running
- PNPM package manager
- A VNPay sandbox account (for testing)

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
# At minimum, configure these essential variables:
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=your_database

# VNPay configuration (get from VNPay dashboard)
VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_IPN_URL=http://localhost:3001/api/payments/vnpay/webhook

# Email alerts (optional but recommended)
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=your-email@example.com
```

### 2. Installation & Database Setup

```bash
# Install dependencies
pnpm install

# Run database migrations
node scripts/run-migrations.js

# Or manually:
pnpm run build
pnpm run typeorm migration:run
```

### 3. Start the Application

```bash
# Development mode
pnpm run start:dev

# Production mode
pnpm run build
pnpm run start:prod
```

### 4. Verify Webhook Setup

```bash
# Test webhook endpoint
node scripts/test-webhook.js

# Windows users
scripts/test-webhook.bat
```

## Key Endpoints

After starting the application, these endpoints will be available:

### Webhook Endpoints

- `POST /api/payments/vnpay/webhook` - VNPay IPN webhook
- `GET /api/payments/vnpay/webhook/health` - Health check
- `GET /api/payments/vnpay/webhook/metrics` - Performance metrics

### Admin Dashboard

- `GET /admin/webhook-dashboard/overview` - Dashboard overview
- `GET /admin/webhook-dashboard/events` - Webhook events log
- `GET /admin/webhook-dashboard/metrics` - Detailed metrics
- `POST /admin/webhook-dashboard/alerts/test` - Test alerts

## Webhook Features

### ✅ Implemented Features

1. **Real-time Webhook Processing**

   - Signature validation
   - Duplicate prevention
   - Error handling and retries

2. **Monitoring & Analytics**

   - Performance metrics tracking
   - Success/failure rate monitoring
   - Processing time analysis

3. **Email Alerting**

   - Email notifications for webhook failures
   - Configurable thresholds and recipients

4. **Administrative Dashboard**

   - Real-time monitoring interface
   - Event history and filtering
   - Performance analytics
   - Manual cleanup tools

5. **Data Management**

   - Automated cleanup jobs
   - Data retention policies
   - Export functionality (CSV/JSON)

6. **Production Ready**
   - Comprehensive error handling
   - Security best practices
   - Performance optimization
   - Detailed logging

## Testing

### Unit Tests

```bash
# Run all tests
pnpm run test

# Run webhook-specific tests
pnpm run test -- --testPathPattern=webhook

# Run with coverage
pnpm run test:cov
```

### Integration Tests

```bash
# Run e2e tests
pnpm run test:e2e
```

### Manual Testing

```bash
# Test webhook endpoints
node scripts/test-webhook.js --scenario success
node scripts/test-webhook.js --scenario failed
node scripts/test-webhook.js --scenario load-test

# Test VNPay payment flow
node scripts/test-vnpay-flow.js
```

## Common Issues & Solutions

### 1. Database Connection Issues

```bash
# Check if MySQL is running
mysql --version

# Test database connection
mysql -h localhost -u root -p your_database
```

### 2. Webhook Not Receiving Requests

- Verify `VNPAY_IPN_URL` in environment
- Check if port 3001 is accessible
- For local testing, use ngrok: `ngrok http 3001`

### 3. Email Alerts Not Working

- Verify OAuth2 Gmail credentials in `.env`
- Check if Gmail OAuth2 is properly configured
- Test email service: `node scripts/test-email.js`

### 4. High Memory Usage

- Increase `WEBHOOK_RETENTION_DAYS` to reduce stored data
- Run manual cleanup: `POST /admin/webhook-dashboard/cleanup/trigger`

## Production Deployment

For production deployment, refer to:

- [Webhook Production Deployment Guide](./webhook-production-deployment.md)
- [Frontend Development Guide](./frontend-development-guide.md)

## Monitoring & Maintenance

### Daily Tasks

- Check dashboard for error rates: `/admin/webhook-dashboard/overview`
- Review alert notifications
- Monitor system performance

### Weekly Tasks

- Review webhook metrics trends
- Check data retention and cleanup
- Update alert thresholds if needed

### Monthly Tasks

- Export webhook data for analysis
- Review and update documentation
- Performance optimization review

## Support & Documentation

- **API Documentation**: Available at `/api-docs` when running
- **Webhook Testing Guide**: [webhook-testing-guide.md](./webhook-testing-guide.md)
- **Frontend Integration**: [frontend-development-guide.md](./frontend-development-guide.md)
- **Production Setup**: [webhook-production-deployment.md](./webhook-production-deployment.md)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VNPay Gateway │───▶│  Webhook API    │───▶│  Order Service  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Alert System    │◀───│ Monitoring Svc  │───▶│   Database      │
│ (Email/Slack)   │    │                 │    │  (Webhook Logs) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │ Admin Dashboard │
                       │   (React UI)    │
                       └─────────────────┘
```

## Next Steps

1. **Frontend Integration**: Build React components for the admin dashboard
2. **Advanced Analytics**: Add more detailed reporting and analytics
3. **API Rate Limiting**: Implement advanced rate limiting for webhook endpoints
4. **Multi-tenant Support**: Add support for multiple VNPay accounts
5. **Real-time Notifications**: WebSocket integration for real-time updates

---

💡 **Pro Tip**: Start with the basic setup and gradually enable advanced features like Slack/Telegram alerts as needed.

🔧 **Need Help?** Check the individual documentation files or create an issue in the project repository.
