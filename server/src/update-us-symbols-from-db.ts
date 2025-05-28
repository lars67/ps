import mongoose from 'mongoose';
import { TradeModel } from './models/trade';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Function to create a backup of the trades collection
async function backupTradesCollection(db: any) {
  try {
    console.log('Creating backup of trades collection...');
    
    // Check if backup collection already exists and drop it if it does
    const collections = await db.listCollections({ name: 'trades_backup_before_mic_update' }).toArray();
    if (collections.length > 0) {
      console.log('Removing existing backup collection...');
      await db.dropCollection('trades_backup_before_mic_update');
    }
    
    // Create a new backup collection
    const result = await db.collection('trades').aggregate([
      { $match: {} },
      { $out: 'trades_backup_before_mic_update' }
    ]).toArray();
    
    // Verify the backup
    const originalCount = await db.collection('trades').countDocuments();
    const backupCount = await db.collection('trades_backup_before_mic_update').countDocuments();
    
    console.log(`Backup created: Original collection has ${originalCount} documents, backup has ${backupCount} documents`);
    
    if (originalCount !== backupCount) {
      throw new Error('Backup verification failed: document counts do not match');
    }
    
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

// Function to recover from backup if something goes wrong
async function recoverFromBackup(db: any) {
  try {
    // Check if backup collection exists
    const collections = await db.listCollections({ name: 'trades_backup_before_mic_update' }).toArray();
    if (collections.length === 0) {
      console.error('No backup collection found. Cannot recover.');
      return false;
    }
    
    console.log('Restoring from backup collection...');
    
    // Restore from backup
    await db.collection('trades_backup_before_mic_update').aggregate([
      { $match: {} },
      { $out: 'trades' }
    ]).toArray();
    
    console.log('Recovery complete. Original data has been restored.');
    return true;
  } catch (error) {
    console.error('Error during recovery:', error);
    console.error('Manual intervention required to restore data.');
    return false;
  }
}

// Main function to update symbols
async function updateSymbols() {
  try {
    // Connect to PS2 database (for trades)
    const ps2Uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';
    console.log(`Connecting to PS2 database at ${ps2Uri}`);
    await mongoose.connect(ps2Uri);
    const ps2Db = mongoose.connection.db;
    console.log('Connected to PS2 database');
    
    // Create a backup of the trades collection
    const backupSuccess = await backupTradesCollection(ps2Db);
    if (!backupSuccess) {
      console.error('Backup failed. Aborting update process for safety.');
      process.exit(1);
    }
    
    console.log('Backup successful. Proceeding with updates...');
    
    // Use MongoDB native driver to connect to Aktia database
    const { MongoClient } = require('mongodb');
    const aktiaUri = process.env.AKTIA_MONGODB_URI || 'mongodb://localhost:27017/Aktia';
    console.log(`Connecting to Aktia database at ${aktiaUri}`);
    const aktiaClient = new MongoClient(aktiaUri);
    await aktiaClient.connect();
    const aktiaDb = aktiaClient.db('Aktia');
    console.log('Connected to Aktia database');
    
    // Get all symbols from Aktia.Symbols collection
    console.log('Fetching symbols from Aktia.Symbols collection...');
    const symbolsCollection = aktiaDb.collection('Symbols');
    
    // Create a map of Symbol -> Symbol-Mic
    const symbolMicMap = new Map<string, string>();
    const symbolExchangeMap = new Map<string, string>();
    
    // Query symbols with their MIC codes
    const symbols = await symbolsCollection.find({}, {
      projection: {
        Symbol: 1,
        'Symbol-Mic': 1,
        Exchange: 1,
        EnrichedCountry: 1,
        'Country or region of registration': 1
      }
    }).toArray();
    
    console.log(`Found ${symbols.length} symbols in Aktia.Symbols collection`);
    
    // Group symbols by Symbol to handle duplicates
    const symbolGroups = new Map<string, any[]>();
    for (const symbol of symbols) {
      if (symbol.Symbol) {
        if (!symbolGroups.has(symbol.Symbol)) {
          symbolGroups.set(symbol.Symbol, []);
        }
        symbolGroups.get(symbol.Symbol)?.push(symbol);
      }
    }
    
    // Process each symbol group
    for (const [symbolKey, symbolRecords] of symbolGroups.entries()) {
      // Find the US exchange record for this symbol
      const usRecord = symbolRecords.find(record => {
        // Must be a US company
        const isUSCompany =
          (record.EnrichedCountry === 'UNITED STATES OF AMERICA' ||
           record['Country or region of registration'] === 'United States');
        
        // Must be on a US exchange
        const exchange = record.Exchange?.toUpperCase() || '';
        const isUSExchange =
          exchange.includes('NYSE') ||
          exchange.includes('NASDAQ') ||
          exchange.includes('OTC') ||
          exchange.includes('PINK');
        
        return isUSCompany && isUSExchange;
      });
      
      if (usRecord) {
        if (usRecord['Symbol-Mic']) {
          // Use existing Symbol-Mic if available
          const mic = usRecord['Symbol-Mic'].split(':')[1];
          if (mic === 'XNAS' || mic === 'XNYS' || mic === 'OTCM') {
            symbolMicMap.set(usRecord.Symbol, usRecord['Symbol-Mic']);
          }
        } else if (usRecord.Exchange) {
          // Create Symbol-Mic based on Exchange
          const exchange = usRecord.Exchange.toUpperCase();
          let mic = '';
          
          if (exchange.includes('NASDAQ')) {
            mic = 'XNAS';
          } else if (exchange.includes('NYSE')) {
            mic = 'XNYS';
          } else if (exchange.includes('OTC') || exchange.includes('PINK')) {
            mic = 'OTCM';
          }
          
          if (mic) {
            symbolMicMap.set(usRecord.Symbol, `${usRecord.Symbol}:${mic}`);
          }
        }
        
        // Still maintain the exchange map for reference
        if (usRecord.Exchange) {
          symbolExchangeMap.set(usRecord.Symbol, usRecord.Exchange);
        }
      }
    }
    
    console.log(`Created mapping for ${symbolMicMap.size} symbols`);
    
    // Find all trades with US symbols that don't already have MIC codes
    const trades = await TradeModel.find({
      $and: [
        { symbol: { $exists: true } },
        { symbol: { $ne: null } },
        { symbol: { $ne: '' } },
        // Filter out symbols that already have a MIC format
        { symbol: { $not: /.*:XNAS|.*:XNYS|.*:OTCM/ } }
      ]
    });
    
    console.log(`Found ${trades.length} trades to process`);
    
    // Process each trade
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    for (const trade of trades) {
      const symbol = trade.symbol;
      
      // Skip if symbol is not a string or is empty
      if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
        skippedCount++;
        continue;
      }
      
      // Skip if symbol already has a MIC format
      if (symbol.includes(':XNAS') || symbol.includes(':XNYS') || symbol.includes(':OTCM')) {
        skippedCount++;
        continue;
      }
      
      // Skip FX symbols
      if (symbol.endsWith(':FX')) {
        skippedCount++;
        continue;
      }
      
      // Look up the symbol in our mapping
      const symbolWithMic = symbolMicMap.get(symbol);
      
      if (symbolWithMic) {
        // Update the trade with the Symbol-Mic from the Symbols collection
        await TradeModel.updateOne(
          { _id: trade._id },
          { $set: { symbol: symbolWithMic } }
        );
        
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} trades so far`);
        }
      } else {
        // Symbol not found in the mapping
        notFoundCount++;
        console.log(`Symbol not found in mapping: ${symbol}`);
        skippedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} trades`);
    console.log(`Skipped ${skippedCount} trades`);
    console.log(`Symbols not found in mapping: ${notFoundCount}`);
    console.log('\nBackup collection "trades_backup_before_mic_update" has been preserved.');
    console.log('If you need to restore the original data, run:');
    console.log('  mongosh mongodb://localhost:27017/ps2');
    console.log('  db.trades_backup_before_mic_update.aggregate([{ $match: {} }, { $out: "trades" }])');
    // Close Aktia connection
    await aktiaClient.close();
    
  } catch (error) {
    console.error('Error updating symbols:', error);
    console.log('\nAttempting to recover from backup...');
    if (mongoose.connection.readyState === 1) { // 1 = connected
      await recoverFromBackup(mongoose.connection.db);
    }
  } finally {
    // Close connection
    await mongoose.disconnect();
    process.exit();
  }
}

// Run the script
updateSymbols();