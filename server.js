const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');

// Create images directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Handle image upload
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    const filename = req.headers['x-filename'] || url.searchParams.get('filename') || `upload_${Date.now()}.jpg`;
    // sanitize filename
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(IMAGES_DIR, safeFilename);

    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        url: `images/${safeFilename}` 
      }));
    });

    req.on('error', (err) => {
      console.error('Upload error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // Handle saving state back to index.html
  if (req.method === 'POST' && url.pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { photos, positions } = data;

        const indexPath = path.join(PUBLIC_DIR, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        // Replace window.SUMANGALI_PHOTOS
        if (photos) {
          const newPhotosString = `window.SUMANGALI_PHOTOS = ${JSON.stringify(photos, null, 2)};`;
          html = html.replace(/window\.SUMANGALI_PHOTOS\s*=\s*\{[\s\S]*?\};/, newPhotosString);
        }

        // Replace window.SUMANGALI_POSITIONS
        if (positions) {
          const newPositionsString = `window.SUMANGALI_POSITIONS = ${JSON.stringify(positions, null, 2)};`;
          if (/window\.SUMANGALI_POSITIONS\s*=\s*\{[\s\S]*?\};/.test(html)) {
            html = html.replace(/window\.SUMANGALI_POSITIONS\s*=\s*\{[\s\S]*?\};/, newPositionsString);
          } else {
            // If it doesn't exist, we can inject it right after SUMANGALI_PHOTOS
            const injectIndex = html.indexOf('window.SUMANGALI_PHOTOS');
            if (injectIndex !== -1) {
              // Find end of SUMANGALI_PHOTOS block
              const blockEnd = html.indexOf('};', injectIndex) + 2;
              html = html.slice(0, blockEnd) + '\n  ' + newPositionsString + html.slice(blockEnd);
            }
          }
        }

        fs.writeFileSync(indexPath, html, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Save error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Handle saving full page HTML back to disk
  if (req.method === 'POST' && url.pathname === '/api/save-page') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { filename, html } = data;
        
        // Safety check to ensure we only save allowed HTML files
        const allowedFiles = ['index.html', 'kids.html', 'men.html', 'women.html', 'baby.html'];
        if (!allowedFiles.includes(filename)) {
          throw new Error('Unauthorized file write');
        }

        const filePath = path.join(PUBLIC_DIR, filename);
        fs.writeFileSync(filePath, html, 'utf8');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('Save page error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));

  // Security check: ensure path is within PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Sumangali Website Editor Running at:`);
  console.log(`   👉 http://localhost:${PORT}/?edit`);
  console.log(`   👉 http://127.0.0.1:${PORT}/?edit`);
  console.log(`==================================================\n`);
});
