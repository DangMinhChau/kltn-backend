# VNPay Webhook Production Deployment Guide

This guide covers the complete production deployment setup for the VNPay webhook system with monitoring, alerting, and performance optimization.

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Database Setup](#database-setup)
3. [Security Configuration](#security-configuration)
4. [Monitoring & Alerting Setup](#monitoring--alerting-setup)
5. [Performance Optimization](#performance-optimization)
6. [SSL/HTTPS Configuration](#sslhttps-configuration)
7. [Load Balancer Configuration](#load-balancer-configuration)
8. [Backup & Recovery](#backup--recovery)
9. [Deployment Checklist](#deployment-checklist)
10. [Troubleshooting](#troubleshooting)

## Environment Configuration

### Required Environment Variables

Create a production environment file (`.env.production`):

```bash
# Database Configuration
DATABASE_HOST=your-production-db-host
DATABASE_PORT=5432
DATABASE_USERNAME=your-db-user
DATABASE_PASSWORD=your-secure-password
DATABASE_NAME=your-production-db

# VNPay Configuration
VNPAY_TMN_CODE=your-production-terminal-code
VNPAY_HASH_SECRET=your-production-hash-secret
VNPAY_URL=https://vnpayment.vn/paymentv2/vpcpay.html
VNPAY_IPN_URL=https://yourdomain.com/webhooks/vnpay/ipn

# Application Configuration
NODE_ENV=production
PORT=3000
JWT_SECRET=your-production-jwt-secret

# OAuth2 Gmail Configuration
EMAIL_FROM=noreply@yourdomain.com
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token

# Redis Configuration (if using Redis for caching)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Webhook Alert Configuration
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=admin@yourdomain.com,ops@yourdomain.com

# Monitoring Configuration
WEBHOOK_CLEANUP_RETENTION_DAYS=30
WEBHOOK_METRICS_RETENTION_HOURS=168  # 7 days
LOG_LEVEL=info
```

### Environment-Specific Configuration

**Staging Environment:**

```bash
# Copy from production but with staging endpoints
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_IPN_URL=https://staging.yourdomain.com/webhooks/vnpay/ipn
```

**Development Environment:**

```bash
# Local development settings
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_IPN_URL=https://ngrok-url.ngrok.io/webhooks/vnpay/ipn
WEBHOOK_ALERTS_EMAIL_ENABLED=false
WEBHOOK_ALERTS_SLACK_ENABLED=false
```

## Database Setup

### Production Database Configuration

1. **Create Database Migration**:

```bash
# Run the webhook events table migration
npm run migration:run
```

2. **Database Indexes** (already created in migration):

```sql
-- Verify indexes are created
\d webhook_events

-- Expected indexes:
-- IDX_webhook_events_order_id
-- IDX_webhook_events_response_code
-- IDX_webhook_events_success
-- IDX_webhook_events_timestamp
-- IDX_webhook_events_order_timestamp
```

3. **Database Connection Pool**:

```typescript
// In your database configuration
{
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  // Production pool settings
  extra: {
    max: 20,          // Maximum connections
    min: 5,           // Minimum connections
    idle: 10000,      // Idle timeout
    acquire: 30000,   // Acquire timeout
    evict: 60000,     // Eviction timeout
  },
  ssl: {
    rejectUnauthorized: false, // For cloud databases
  },
}
```

## Security Configuration

### 1. Webhook Security Headers

```typescript
// Add to your main.ts or webhook controller
app.use('/webhooks', (req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

### 2. Rate Limiting

```bash
npm install @nestjs/throttler
```

```typescript
// Configure rate limiting for webhooks
@Controller('webhooks/vnpay')
@Throttle(100, 60) // 100 requests per minute
export class VNPayWebhookController {
  // ... webhook handlers
}
```

### 3. IP Whitelisting (Optional)

```typescript
// Middleware to check VNPay IP ranges
const vnpayIpRanges = [
  '203.171.21.0/24',
  '203.171.22.0/24',
  // Add VNPay's official IP ranges
];

export function vnpayIpFilter(req, res, next) {
  const clientIp = req.ip || req.connection.remoteAddress;

  // Check if IP is in allowed ranges
  const isAllowed = vnpayIpRanges.some((range) =>
    ipRangeCheck(clientIp, range),
  );

  if (!isAllowed) {
    return res.status(403).json({ message: 'IP not allowed' });
  }

  next();
}
```

## Monitoring & Alerting Setup

### Email Alerts Configuration

Configure Gmail OAuth2 for reliable email delivery:

```typescript
// Ensure MailService is properly configured with OAuth2
{
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_FROM,
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
}
```

**Required Environment Variables:**

```bash
# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
EMAIL_FROM=your_email@gmail.com

# Webhook Alert Configuration
WEBHOOK_ALERTS_EMAIL_ENABLED=true
WEBHOOK_ALERTS_EMAIL_RECIPIENTS=admin@yourdomain.com,ops@yourdomain.com
```

**Test Email Configuration:**

```bash
node scripts/test-email.js
```

## Performance Optimization

### 1. Database Connection Optimization

```typescript
// Add to your TypeORM configuration
{
  logging: process.env.NODE_ENV === 'development',
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
    },
  },
  // Connection pool optimization
  extra: {
    max: 20,
    min: 5,
    idle: 10000,
    acquire: 30000,
  },
}
```

### 2. Webhook Processing Optimization

```typescript
// Use async processing for heavy operations
@Post('ipn')
async handlePaymentNotification(@Body() webhookData: VNPayWebhookDto) {
  // Quick response to VNPay
  const response = await this.quickValidation(webhookData);

  // Process heavy operations asynchronously
  setImmediate(() => {
    this.processWebhookAsync(webhookData);
  });

  return response;
}
```

### 3. Cleanup Job Configuration

Create a scheduled cleanup job:

```typescript
// webhook-cleanup.service.ts
@Injectable()
export class WebhookCleanupService {
  constructor(private readonly webhookMonitoring: WebhookMonitoringService) {}

  @Cron('0 2 * * *') // Run daily at 2 AM
  async cleanupOldEvents() {
    const retentionDays = parseInt(
      process.env.WEBHOOK_CLEANUP_RETENTION_DAYS || '30',
    );

    await this.webhookMonitoring.cleanupOldEvents(retentionDays);
  }
}
```

## SSL/HTTPS Configuration

### 1. SSL Certificate Setup

```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # SSL optimization
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location /webhooks/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Force HTTPS Redirect

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Load Balancer Configuration

### 1. Health Check Endpoint

```typescript
@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };
  }

  @Get('webhook')
  getWebhookHealth() {
    return this.webhookMonitoring.getHealthStatus();
  }
}
```

### 2. Load Balancer Configuration

```yaml
# AWS Application Load Balancer example
TargetGroups:
  - Name: webhook-target-group
    Protocol: HTTP
    Port: 3000
    HealthCheckPath: /health
    HealthCheckIntervalSeconds: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
```

## Backup & Recovery

### 1. Database Backup Strategy

```bash
#!/bin/bash
# backup-webhook-data.sh

BACKUP_DIR="/backups/webhook-data"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup webhook events table
pg_dump -h $DATABASE_HOST -U $DATABASE_USERNAME \
  --table=webhook_events \
  $DATABASE_NAME > $BACKUP_DIR/webhook_events_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "webhook_events_*.sql" -mtime +7 -delete
```

### 2. Application State Backup

```typescript
// Export webhook metrics and configuration
@Controller('admin/backup')
export class BackupController {
  @Get('webhook-metrics')
  async exportWebhookMetrics() {
    return {
      metrics: await this.webhookMonitoring.getDbMetrics(168), // 7 days
      configuration: {
        alertsEnabled: process.env.WEBHOOK_ALERTS_EMAIL_ENABLED,
        retentionDays: process.env.WEBHOOK_CLEANUP_RETENTION_DAYS,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured and secured
- [ ] Database migrations run successfully
- [ ] SSL certificates installed and verified
- [ ] VNPay merchant account configured with production IPN URL
- [ ] Alert channels (Slack, Telegram) tested
- [ ] Email service tested
- [ ] Backup systems in place

### During Deployment

- [ ] Deploy application with zero downtime
- [ ] Verify webhook endpoint accessibility
- [ ] Test webhook signature validation
- [ ] Verify database connectivity
- [ ] Check application logs for errors

### Post-Deployment

- [ ] Monitor webhook health endpoint
- [ ] Test payment flow end-to-end
- [ ] Verify alert notifications work
- [ ] Check webhook processing times
- [ ] Monitor error rates
- [ ] Verify cleanup job scheduling

### Production Monitoring Commands

```bash
# Check application health
curl https://yourdomain.com/health/webhook

# Monitor webhook metrics
curl https://yourdomain.com/webhooks/vnpay/metrics

# Check recent webhook events
curl https://yourdomain.com/webhooks/vnpay/events?limit=10

# Monitor application logs
tail -f /var/log/app/production.log | grep "VNPayWebhook"

# Check database performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT COUNT(*) as total_events,
         AVG(processing_time) as avg_time,
         COUNT(*) FILTER (WHERE success = false) as failures
  FROM webhook_events
  WHERE timestamp > NOW() - INTERVAL '1 hour';"
```

## Troubleshooting

### Common Production Issues

1. **High Response Times**:

   ```bash
   # Check database queries
   SELECT query, mean_time, calls
   FROM pg_stat_statements
   WHERE query LIKE '%webhook_events%'
   ORDER BY mean_time DESC;
   ```

2. **Memory Leaks**:

   ```bash
   # Monitor memory usage
   pm2 monit

   # Check for memory leaks
   node --inspect-brk=0.0.0.0:9229 dist/main.js
   ```

3. **Database Connection Issues**:

   ```bash
   # Check active connections
   SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

   # Check long-running queries
   SELECT query, state, query_start
   FROM pg_stat_activity
   WHERE query_start < NOW() - INTERVAL '5 minutes';
   ```

4. **Alert Failures**:

   ```bash
   # Test alert endpoints
   curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test message"}'

   # Check Telegram bot
   curl "https://api.telegram.org/bot$BOT_TOKEN/getMe"
   ```

### Performance Tuning

1. **Database Optimization**:

   ```sql
   -- Add additional indexes if needed
   CREATE INDEX CONCURRENTLY idx_webhook_events_metadata
   ON webhook_events USING GIN (metadata);

   -- Analyze table statistics
   ANALYZE webhook_events;
   ```

2. **Application Optimization**:

   ```typescript
   // Use batch processing for bulk operations
   async bulkProcessWebhooks(events: WebhookEventCreateDto[]) {
     await this.webhookEventRepository
       .createQueryBuilder()
       .insert()
       .values(events)
       .execute();
   }
   ```

3. **Caching Strategy**:
   ```typescript
   // Cache frequently accessed data
   @CacheKey('webhook-metrics')
   @CacheTTL(300) // 5 minutes
   async getWebhookMetrics() {
     return this.webhookMonitoring.getMetrics();
   }
   ```

### Emergency Procedures

1. **High Error Rate Response**:

   - Check VNPay service status
   - Verify network connectivity
   - Review recent code deployments
   - Scale up application instances if needed

2. **Database Issues**:

   - Check disk space and connections
   - Review slow query logs
   - Consider read replicas for metrics queries
   - Implement graceful degradation

3. **Alert Storm Prevention**:
   - Implement alert throttling
   - Group similar alerts
   - Set up alert escalation rules

This production deployment guide ensures your VNPay webhook system is robust, secure, and production-ready with comprehensive monitoring and alerting capabilities.
