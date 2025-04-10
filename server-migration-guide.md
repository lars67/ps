# Server Migration Guide: Moving to finex.dk

This document outlines the steps needed when moving finex.dk to the current server and closing the top.softcapital.com server.

## Current Setup

- The server is running on localhost (ports 3331, 3332, 3333, 3334)
- The React app is configured to connect to finpension.dk
- The server is using https://top.softcapital.com/scproxy as the data source for quotes

## Changes Needed

### 1. Update DATA_PROXY Environment Variable

Currently, the server is using top.softcapital.com as the data source for quotes. When the other server is closed, you'll need to implement this functionality locally.

In `server/.env`:

```
# Change from
DATA_PROXY=https://top.softcapital.com/scproxy

# To
DATA_PROXY=https://finex.dk:3333/scproxy
```

### 2. Implement Local Proxy Endpoint

You'll need to implement a route handler for the `/scproxy/quotes` endpoint on the local server. Add this to `server/src/app.ts`:

```typescript
// SSE endpoint for quotes
app.get("/scproxy/quotes", (req, res) => {
  const symbols = req.query.symbols as string;
  console.log(`SSE request for symbols: ${symbols}`);
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Implement your quotes data source here
  // This could be a database query, API call, or other data source
  
  // Example implementation with mock data
  const sendQuoteData = (symbol) => {
    const data = [{
      symbol,
      currency: 'USD',
      exchange: 'NMS',
      high: 390 + Math.random() * 10,
      low: 380 + Math.random() * 10,
      latestPrice: 385 + Math.random() * 10,
      lastTradeTime: new Date().toISOString(),
      volume: Math.floor(Math.random() * 10000000),
      close: 385 + Math.random() * 10,
      change: Math.random() * 2 - 1,
      changePercent: (Math.random() * 2 - 1) / 100,
      iexBidPrice: 0,
      iexBidSize: 0,
      iexAskPrice: 0,
      iexAskSize: 0,
      marketCap: 2889588146176,
      week52High: 468.35,
      week52Low: 376.91,
      companyName: symbol === 'MSFT' ? 'Microsoft Corporation' : 'Unknown Company',
      country: 'United States'
    }];
    
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  
  // Send initial data
  const symbolsArray = symbols.split(',');
  symbolsArray.forEach(symbol => sendQuoteData(symbol));
  
  // Set up interval to send updates
  const interval = setInterval(() => {
    symbolsArray.forEach(symbol => sendQuoteData(symbol));
  }, 5000);
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval);
    console.log(`Client closed connection for symbols: ${symbols}`);
  });
});
```

### 3. Update DNS Records

Ensure that the DNS records for finex.dk point to the IP address of the current server.

### 4. Configure Server to Listen on External IP

Make sure the server is configured to listen on the external IP address, not just localhost. This may require updating the server configuration or firewall settings.

### 5. Update SSL Certificates

Ensure that the SSL certificates for finex.dk are properly installed on the server. The certificates should be configured in `server/src/app.ts`:

```typescript
const key = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/finpension.dk.key"));
const cert = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/finpension_dk.crt"));
const ca = fs.readFileSync(path.join(process.cwd(), "../CertFinPension/My_CA_Bundle.ca-bundle"));
```

### 6. Test the Connection

After making these changes, test the connection from both the React app and external clients:

1. Test the React app by running it and verifying that it can connect to the server and receive quotes data
2. Test external clients by running the test script from another machine:

```javascript
const WebSocket = require('ws');

// Disable certificate validation for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Create WebSocket connection for login
console.log('Connecting to login server...');
const loginWs = new WebSocket('wss://finex.dk:3331');

// Handle login connection
loginWs.on('open', function() {
  console.log('Connected to login server');
  
  // Send login credentials
  const loginData = {
    login: 'admin',
    password: '111111'
  };
  
  console.log('Sending login request...');
  loginWs.send(JSON.stringify(loginData));
});

// Handle login response
loginWs.on('message', function(data) {
  try {
    const response = JSON.parse(data);
    console.log('Login response:', response);
    
    if (response.token) {
      console.log('Login successful, received token');
      
      // Now connect to the main server with the token
      connectToMainServer(response.token);
    } else if (response.error) {
      console.error('Login failed:', response.error);
    }
  } catch (error) {
    console.error('Error parsing login response:', error);
  }
});

// Connect to main server with token
function connectToMainServer(token) {
  console.log('Connecting to main server...');
  
  // Create WebSocket connection with token in query string
  const mainWs = new WebSocket(`wss://finex.dk:3332?${token}`);
  
  // Connection opened
  mainWs.on('open', function() {
    console.log('Connected to main server');
    
    // Send the quotes command
    const quotesCommand = {
      command: "prices.quotes",
      symbols: "MSFT",
      requestType: "0",
      subscribeId: "",
      precision: 4,
      msgId: Date.now().toString()
    };
    
    console.log('Sending quotes command:', quotesCommand);
    mainWs.send(JSON.stringify(quotesCommand));
  });
  
  // Handle messages from the server
  mainWs.on('message', function(data) {
    try {
      const message = JSON.parse(data);
      console.log('Received message:', message);
    } catch (error) {
      console.error('Error parsing message:', error);
      console.log('Raw message:', data.toString());
    }
  });
}
```

### 7. Update Firewall Rules

Ensure that the firewall rules allow external connections to ports 3331, 3332, 3333, and 3334.

## Conclusion

By following these steps, you should be able to successfully migrate the server to finex.dk and close the top.softcapital.com server. The key is to implement the quotes data source locally and ensure that the server is properly configured to handle external connections.