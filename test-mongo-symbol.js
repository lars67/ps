require('dotenv').config({ path: './server/.env' });
const { MongoClient } = require('mongodb');

async function testSymbolLookup() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI environment variable not set');
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    // Explicitly specify the database name where sector data is stored
    const db = client.db('Aktia');
    const collection = db.collection('Symbols');

    const symbols = ['NVDA', 'NVDA:XNAS'];
    
    for (const symbol of symbols) {
      let doc = await collection.findOne({ 'Symbol-Mic': symbol });
      
      if (!doc) {
        doc = await collection.findOne({
          $or: [
            { Symbol: symbol },
            { 'Symbol-Mic': new RegExp(`^${symbol}:`) },
            { 'Symbol-Ric': new RegExp(`^${symbol}\\.`) }
          ]
        });
      }

      console.log(`Query for ${symbol}:`);
      console.log('Document:', doc);
      console.log('Sector:', doc?.Sector || 'Not found');
      console.log('--------------------------------');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

testSymbolLookup();