/**
 * Quick MongoDB Check Script
 * Check if portfolio_histories collection exists and has data
 */

require('dotenv').config({ path: './.env' });
const { MongoClient } = require('mongodb');

async function checkMongo() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('ps2');

    console.log('🔍 Checking MongoDB Collections...');

    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    console.log('📋 All collections:', collectionNames.join(', '));

    // Check portfolio-related collections
    const portfolioCollections = collectionNames.filter(name => name.includes('portfolio'));
    console.log('📊 Portfolio collections:', portfolioCollections.join(', '));

    // Check portfolio_histories specifically
    if (collectionNames.includes('portfolio_histories')) {
      const count = await db.collection('portfolio_histories').countDocuments();
      console.log('✅ portfolio_histories collection exists with', count, 'documents');

      if (count > 0) {
        // Show a sample document
        const sample = await db.collection('portfolio_histories').findOne();
        console.log('📄 Sample document:');
        console.log(JSON.stringify(sample, null, 2));

        // Show distinct portfolio IDs
        const portfolioIds = await db.collection('portfolio_histories').distinct('portfolioId');
        console.log('🎯 Portfolio IDs with cached history:', portfolioIds.length);
        console.log('IDs:', portfolioIds.slice(0, 5).join(', '), portfolioIds.length > 5 ? '...' : '');
      }
    } else {
      console.log('❌ portfolio_histories collection does not exist');
    }

    // Check portfolios collection
    if (collectionNames.includes('portfolios')) {
      const portfolioCount = await db.collection('portfolios').countDocuments();
      console.log('📊 portfolios collection has', portfolioCount, 'documents');
    }

  } catch (error) {
    console.error('❌ MongoDB check failed:', error.message);
  } finally {
    await client.close();
  }
}

checkMongo();
