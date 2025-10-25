# PDF Password Server

A secure Docker container for serving password-protected PDFs with JWT authentication, CORS support, and rate limiting. Designed to work seamlessly with the [PDF Password Overlay React App](https://github.com/ajcampbell1333/PDFPasswordOverlay).

## Related Project

This server is designed to integrate with the [PDF Password Overlay React App](https://github.com/ajcampbell1333/PDFPasswordOverlay) for a complete client-server password-protected PDF solution.

## Features

- 🔐 **JWT Authentication** - Secure token-based access
- 🛡️ **Rate Limiting** - Prevent abuse with configurable limits
- 🌐 **CORS Support** - Control which domains can access your PDFs
- 📄 **Secure PDF Serving** - No-cache headers and security controls
- 🐳 **Docker Ready** - Easy deployment to GCP Cloud Run, AWS, or any container platform
- ⚡ **Health Checks** - Built-in monitoring endpoints
- 🔒 **CSP Headers** - Content Security Policy for iframe embedding control

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your settings
nano .env
```

### 2. Add Your PDF

```bash
# Place your PDF in the pdfs directory
cp /path/to/your/document.pdf pdfs/your-document.pdf
```

### 3. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Docker Build & Run

```bash
# Build the container
docker build -t pdf-password-server .

# Run locally
docker run -p 3000:3000 --env-file .env pdf-password-server
```

## GCP Cloud Run Deployment

### Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud CLI** installed ([Download here](https://cloud.google.com/sdk/docs/install))
3. **Docker Desktop** installed and running
4. **GCP Project created** in the Google Cloud Console

### Initial Setup

1. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   ```

2. **Set your project ID**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable required APIs**:
   ```bash
   gcloud services enable containerregistry.googleapis.com run.googleapis.com
   ```

4. **Configure Docker for GCP**:
   ```bash
   gcloud auth configure-docker
   ```

### Deployment Steps

#### 1. Prepare Your Environment

Create a `.env` file locally for testing (never commit this):

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Copy the output and create .env
JWT_SECRET=your-generated-secret-here
PDF_PASSWORD=your-pdf-password
ALLOWED_ORIGINS=https://yourdomain.com
NODE_ENV=production
```

#### 2. Add Your PDF Files

```bash
# Copy your PDF(s) to the pdfs directory
cp /path/to/your/document.pdf pdfs/
```

#### 3. Build and Push to Google Container Registry

```bash
# Build the Docker image
docker build -t gcr.io/YOUR_PROJECT_ID/pdf-password-server .

# Push to Google Container Registry
docker push gcr.io/YOUR_PROJECT_ID/pdf-password-server
```

**Note**: Replace `YOUR_PROJECT_ID` with your actual GCP project ID (e.g., `pdf-server-476123`).

#### 4. Create Cloud Run Service

**Option A: Using gcloud CLI**

```bash
gcloud run deploy pdf-password-server \
  --image gcr.io/YOUR_PROJECT_ID/pdf-password-server \
  --platform managed \
  --region us-west2 \
  --allow-unauthenticated \
  --set-env-vars="PDF_PASSWORD=your-password,JWT_SECRET=your-jwt-secret,ALLOWED_ORIGINS=https://yourdomain.com"
```

**Option B: Using GCP Console**

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click "Create Service"
3. Select "Deploy one revision from an existing container image"
4. Enter your image URL: `gcr.io/YOUR_PROJECT_ID/pdf-password-server`
5. Set service name: `pdf-password-server`
6. Select region: `us-west2` (or your preferred region)
7. Under "Authentication": Select "Allow unauthenticated invocations"
8. Click "Container, Variables & Secrets, Connections, Security"
9. Add environment variables:
   - `JWT_SECRET`: Your generated secret
   - `PDF_PASSWORD`: Your password
   - `ALLOWED_ORIGINS`: Your domain (e.g., `https://yourdomain.com`)
10. Click "Create"

#### 5. Get Your Service URL

After deployment, you'll receive a URL like:
```
https://pdf-password-server-XXXXXXXXXXXX.region.run.app
```

**Copy this URL** - you'll need it for the React app configuration.

### Update and Redeploy

When you need to update the server (e.g., change PDF files, update CSP settings):

1. **Make your changes** to the code or PDF files

2. **Update CSP frame-ancestors** in `server.js` if needed:
   ```javascript
   "frame-ancestors": ["'self'", "https://yourdomain.com"]
   ```

3. **Rebuild and push**:
   ```bash
   docker build -t gcr.io/YOUR_PROJECT_ID/pdf-password-server .
   docker push gcr.io/YOUR_PROJECT_ID/pdf-password-server
   ```

4. **Redeploy to Cloud Run**:
   ```bash
   gcloud run deploy pdf-password-server \
     --image gcr.io/YOUR_PROJECT_ID/pdf-password-server \
     --region us-west2 \
     --platform managed \
     --allow-unauthenticated
   ```

   **Note**: Environment variables persist between deployments. To update them:
   ```bash
   gcloud run services update pdf-password-server \
     --region us-west2 \
     --set-env-vars="PDF_PASSWORD=new-password,JWT_SECRET=new-secret"
   ```

### Cost Management

#### Set Up Budget Alerts

1. Go to [GCP Billing](https://console.cloud.google.com/billing)
2. Select your billing account
3. Click "Budgets & alerts"
4. Create a budget with alerts at 50%, 90%, and 100%
5. Set the budget amount (e.g., $0 for free tier only, or $10/month)

#### Free Tier Limits

Cloud Run free tier includes:
- 2 million requests/month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds
- 1 GB network egress to North America per month

**Important**: Monitor your usage to avoid unexpected charges. Set up billing alerts!

### Monitoring Your Deployment

#### View Logs

```bash
# Stream logs in real-time
gcloud run services logs tail pdf-password-server --region us-west2

# View logs in GCP Console
# https://console.cloud.google.com/run > Select service > Logs
```

#### Check Service Status

```bash
# Get service details
gcloud run services describe pdf-password-server --region us-west2

# Test health endpoint
curl https://your-service-url.run.app/health
```

## API Endpoints

### Authentication
```
POST /auth
Content-Type: application/json

{
  "password": "your-pdf-password"
}

Response:
{
  "success": true,
  "token": "jwt-token-here",
  "expiresIn": 3600
}
```

### PDF Access

**Option 1: Query Parameter (Recommended for iframes)**
```
GET /pdf/{filename}?token={jwt-token}

Response: PDF file with security headers
```

**Option 2: Authorization Header**
```
GET /pdf/{filename}
Authorization: Bearer {jwt-token}

Response: PDF file with security headers
```

### Health Check
```
GET /health

Response:
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Security Features

- **JWT Tokens** - 1-hour expiration
- **Rate Limiting** - 100 requests/15min, 10 PDF requests/5min
- **CORS Protection** - Only allowed origins
- **File Validation** - Prevents directory traversal
- **Security Headers** - No-cache, no-index, etc.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing secret | Required |
| `PDF_PASSWORD` | Password for PDF access | Required |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://yourdomain.com` |
| `NODE_ENV` | Environment | `production` |

## Integration with React App

This server is designed to work with the [PDF Password Overlay React App](https://github.com/ajcampbell1333/PDFPasswordOverlay). After deploying this server, configure the React app:

### 1. Get Your Cloud Run Service URL

After deployment, copy your service URL:
```
https://pdf-password-server-XXXXXXXXXXXX.region.run.app
```

### 2. Configure the React App

Update `src/App.js` in the [PDF Password Overlay React App](https://github.com/ajcampbell1333/PDFPasswordOverlay):

```javascript
// Enable server-hosted PDFs
const serverHostedPDF = true;

// Set your Cloud Run service URL
const DOCKER_SERVER_URL = 'https://pdf-password-server-XXXXXXXXXXXX.region.run.app';

// Set your PDF filename (must match the file in the server's pdfs/ directory)
const PDF_FILENAME = 'your-document.pdf';

// Set the same password as your server
const CORRECT_PASSWORD = 'your-password';
```

### 3. Update CSP for Your Domain

In this server's `server.js`, update the CSP to allow your domain:

```javascript
"frame-ancestors": ["'self'", "https://yourdomain.com"]
```

Then rebuild and redeploy this server.

### 4. Deploy the React App

Follow the deployment instructions in the [React app's README](https://github.com/ajcampbell1333/PDFPasswordOverlay#deployment) to build and deploy to your web server.

### Authentication Flow

The React app will automatically:
1. Show password overlay on page load
2. When user enters password → Send to `POST /auth` endpoint
3. Server validates password → Returns JWT token
4. React app loads PDF with token → `GET /pdf/{filename}?token={jwt-token}`
5. Server validates token → Serves PDF with security headers

## Monitoring

- **Health Check**: `GET /health`
- **Logs**: Check Cloud Run logs in GCP Console
- **Metrics**: Built-in rate limiting and error tracking

## Development

```bash
# Install dependencies
npm install

# Run with nodemon
npm run dev

# Run tests
npm test
```

## Troubleshooting

### 401 Unauthorized Errors

**Symptom**: Browser shows "invalid token" or 401 errors when loading PDF

**Solutions**:
- Ensure the password in the React app matches the server's `PDF_PASSWORD`
- Check that the JWT token is being passed correctly (visible in Network tab)
- Verify the `JWT_SECRET` is set correctly in Cloud Run environment variables
- Check server logs: `gcloud run services logs tail pdf-password-server --region us-west2`

### CORS Errors

**Symptom**: Browser console shows CORS policy errors

**Solutions**:
- Add your domain to `ALLOWED_ORIGINS` environment variable in Cloud Run
- Format: `https://yourdomain.com` (no trailing slash)
- For multiple domains: `https://domain1.com,https://domain2.com`
- Rebuild and redeploy after changing `ALLOWED_ORIGINS`

### CSP Frame-Ancestors Errors

**Symptom**: "Refused to frame" error in browser console

**Solutions**:
- Update `server.js` line 18 with your domain:
  ```javascript
  "frame-ancestors": ["'self'", "https://yourdomain.com"]
  ```
- Rebuild and redeploy the Docker container
- Clear browser cache and test again

### PDF Not Found (404)

**Symptom**: 404 error when accessing PDF endpoint

**Solutions**:
- Verify the PDF file exists in the `pdfs/` directory before building
- Check the filename matches exactly (case-sensitive)
- Rebuild the Docker image after adding PDFs
- Check the `PDF_FILENAME` in the React app matches the server's file

### Docker Build Fails

**Symptom**: `docker build` command fails or takes too long

**Solutions**:
- Ensure Docker Desktop is running
- Check your internet connection (downloads Node.js base image)
- Remove large files from the directory before building
- Clear Docker cache: `docker system prune -a`

### Cloud Run Deployment Fails

**Symptom**: `gcloud run deploy` fails with authentication or permission errors

**Solutions**:
- Authenticate: `gcloud auth login`
- Set project: `gcloud config set project YOUR_PROJECT_ID`
- Enable APIs: `gcloud services enable containerregistry.googleapis.com run.googleapis.com`
- Check billing is enabled on your GCP project

## License

MIT
