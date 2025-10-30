const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration: Serve PNGs to iOS devices instead of PDF
const SERVE_PNGS_FOR_IOS = process.env.SERVE_PNGS_FOR_IOS === 'true' || false;

// CORS configuration - MUST come before Helmet to avoid conflicts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://URL.info'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Security middleware with CSP configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'", "https://yourdomain.com"],
      "img-src": ["'self'", "data:", "https://yourdomain.com", "https://*.yourdomain.com"]
    }
  },
  crossOriginResourcePolicy: false // Disable to prevent CORS conflicts
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// PDF-specific rate limiting (stricter)
const pdfLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 PDF requests per 5 minutes (increased for testing)
  message: 'Too many PDF requests, please try again later.'
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Helper function to get PNG list for a PDF
function getPngListForPdf(pdfFilename) {
  const baseName = pdfFilename.replace('.pdf', '');
  const pngsDir = path.join(__dirname, 'pngs');
  
  if (!fs.existsSync(pngsDir)) {
    return [];
  }
  
  // Find all PNG files matching the pattern: baseName-1.png, baseName-2.png, etc.
  const files = fs.readdirSync(pngsDir);
  const pngFiles = files
    .filter(file => file.startsWith(baseName + '-') && file.endsWith('.png'))
    .sort((a, b) => {
      // Extract page numbers and sort numerically
      const aNum = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0');
      const bNum = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0');
      return aNum - bNum;
    });
  
  return pngFiles;
}

// Authentication endpoint
app.post('/auth', (req, res) => {
  const { password, isIOS, pdfFilename } = req.body;
  
  if (password === process.env.PDF_PASSWORD) {
    const token = jwt.sign(
      { 
        authenticated: true,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // Check if we should serve PNGs for iOS
    const shouldServePngs = SERVE_PNGS_FOR_IOS && isIOS && pdfFilename;
    
    if (shouldServePngs) {
      const pngFiles = getPngListForPdf(pdfFilename);
      
      if (pngFiles.length > 0) {
        // Return PNG array instead of regular success
        res.json({ 
          success: true, 
          token,
          expiresIn: 3600, // 1 hour in seconds
          usePngMode: true,
          pngFiles: pngFiles // Array of filenames
        });
        return;
      }
    }
    
    // Standard response (no PNGs or PNG mode disabled)
    res.json({ 
      success: true, 
      token,
      expiresIn: 3600 // 1 hour in seconds
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid password' 
    });
  }
});

// PDF serving endpoint
app.get('/pdf/:filename', pdfLimiter, (req, res) => {
  const { filename } = req.params;
  // Accept token from either Authorization header OR query parameter (for iframe support)
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if token is expired (additional check)
    const tokenAge = Date.now() - decoded.timestamp;
    if (tokenAge > 3600000) { // 1 hour
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Validate filename (prevent directory traversal)
    if (!filename.match(/^[a-zA-Z0-9\-_\.]+\.pdf$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, 'pdfs', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    // Set security headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    
    // Stream the PDF
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('PDF serving error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// PNG serving endpoint (for iOS devices)
app.get('/png/:filename', pdfLimiter, (req, res) => {
  const { filename } = req.params;
  // Accept token from either Authorization header OR query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if token is expired
    const tokenAge = Date.now() - decoded.timestamp;
    if (tokenAge > 3600000) { // 1 hour
      return res.status(401).json({ error: 'Token expired' });
    }
    
    // Validate filename (prevent directory traversal)
    if (!filename.match(/^[a-zA-Z0-9\-_\.]+\.png$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(__dirname, 'pngs', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PNG not found' });
    }
    
    // Set security headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    
    // Stream the PNG
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('PNG serving error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PDF Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});


