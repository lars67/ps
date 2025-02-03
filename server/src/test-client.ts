import https from 'https';
import fs from 'fs';
import path from 'path';

async function runTest() {
  try {
    // Get the project root directory
    const projectRoot = path.resolve(__dirname, '../../');
    console.log('Project root:', projectRoot);
    
    // Read certificate
    const certPath = path.join(projectRoot, "Certificate/STAR.softcapital.com.ca.pem");
    console.log('Certificate path:', certPath);
    const ca = fs.readFileSync(certPath);
    console.log('Certificate loaded successfully');

    console.log('Creating HTTPS request...');
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/hi',
      method: 'GET',
      ca: ca,
      rejectUnauthorized: false
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        console.log('Connected to server');
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', res.headers);
        
        let data = '';
        res.on('data', (chunk) => {
          console.log('Received chunk:', chunk.toString());
          data += chunk;
        });
        
        res.on('end', () => {
          console.log('Response complete:', data);
          resolve(data);
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        reject(error);
      });

      console.log('Sending request...');
      req.end();
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error('Top level error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    } else {
      console.error('Unknown error:', error);
    }
    throw error;
  }
}

console.log('Starting test...');
runTest()
  .then(result => console.log('Test completed successfully'))
  .catch(error => console.error('Test failed'));
