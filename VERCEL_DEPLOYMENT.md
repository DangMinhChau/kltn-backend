# Vercel Deployment Guide

## Environment Variables cần thiết trên Vercel:

### Database

- `DB_HOST`: Database host
- `DB_PORT`: Database port (3306)
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name

### JWT

- `JWT_SECRET`: JWT secret key
- `JWT_ACCESS_TOKEN_EXPIRES_IN`: 24h
- `JWT_REFRESH_TOKEN_EXPIRES_IN`: 7d

### Cloudinary

- `CLOUDINARY_CLOUD_NAME`: Your cloudinary cloud name
- `CLOUDINARY_API_KEY`: Your cloudinary API key
- `CLOUDINARY_API_SECRET`: Your cloudinary API secret

### Gmail OAuth

- `GMAIL_CLIENT_ID`: Gmail OAuth client ID
- `GMAIL_CLIENT_SECRET`: Gmail OAuth client secret
- `GMAIL_REFRESH_TOKEN`: Gmail refresh token
- `EMAIL_FROM`: Your email address

### VNPAY

- `VNPAY_URL`: VNPAY payment URL
- `VNPAY_TMN_CODE`: VNPAY merchant code
- `VNPAY_HASH_SECRET`: VNPAY hash secret
- `VNPAY_RETURN_URL`: Frontend return URL
- `VNPAY_IPN_URL`: Backend webhook URL

### GHN Shipping

- `GHN_API_URL`: GHN API URL
- `GHN_TOKEN`: GHN API token
- `GHN_SHOP_ID`: Your shop ID

### Application

- `NODE_ENV`: production
- `PORT`: 8000
- `FRONTEND_URL`: Your frontend URL

## Deployment Steps:

1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

## Important Notes:

- Database synchronize is disabled in production
- SSL is enabled for production database connections
- CORS is configured for your frontend domain
- Static files are served from /public directory
- API documentation available at /api/docs
