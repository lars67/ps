import { connect } from 'mongoose';
import { TradeModel } from './models/trade';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Interface for MIC mapping
interface MICMapping {
  country: string;
  defaultCurrency: string;
  ricExchange: string;
  isoCountryCode: string;
  mic: string;
  operatingMic: string;
  tradingview: string;
  eodHd: string;
}

// Function to parse the MIC CSV file
async function parseMICFile(filePath: string): Promise<Map<string, string>> {
  const micMap = new Map<string, string>();
  const exchangeMap = new Map<string, string>();
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Skip header line
  let isFirstLine = true;

  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }

    const columns = line.split(';');
    const country = columns[0];
    const ricExchange = columns[2]; // RIC Exchange
    const mic = columns[4];         // MIC
    const tradingview = columns[6]; // TRADINGVIEW

    // We're only interested in US exchanges: XNAS, XNYS, OTCM
    if (country === 'UNITED STATES OF AMERICA') {
      if (mic === 'XNAS' || mic === 'XNYS' || mic === 'OTCM') {
        // Map RIC Exchange to MIC if available
        if (ricExchange) {
          exchangeMap.set(ricExchange, mic);
        }
        
        // Map TradingView identifier to MIC
        if (tradingview) {
          exchangeMap.set(tradingview, mic);
        }
        
        // Store MIC code
        micMap.set(mic, mic);
        
        console.log(`Found US exchange: ${mic}, RIC: ${ricExchange}, TradingView: ${tradingview}`);
      }
    }
  }

  // Add common mappings for US exchanges
  // NASDAQ
  exchangeMap.set('NASDAQ', 'XNAS');
  exchangeMap.set('NDQ', 'XNAS');
  exchangeMap.set('NQ', 'XNAS');
  
  // NYSE
  exchangeMap.set('NYSE', 'XNYS');
  exchangeMap.set('NY', 'XNYS');
  
  // OTC Markets
  exchangeMap.set('OTC', 'OTCM');
  exchangeMap.set('OTCBB', 'OTCM');
  exchangeMap.set('OTCQX', 'OTCM');
  exchangeMap.set('OTCQB', 'OTCM');
  exchangeMap.set('PINK', 'OTCM');
  exchangeMap.set('PK', 'OTCM');

  console.log('Finished parsing MIC file');
  return exchangeMap;
}

// Function to determine which MIC a US symbol belongs to based on patterns
function determineMIC(symbol: string, exchangeMap: Map<string, string>): string | null {
  // For US symbols, there are no extensions in the original symbols
  // We just need to determine which exchange they belong to
  
  // Default mapping based on symbol length (common pattern)
  // Stocks with 1-3 letters are often on NYSE
  // Longer symbols are often on NASDAQ
  if (symbol.length <= 3) {
    return `${symbol}:XNYS`;
  } else {
    return `${symbol}:XNAS`;
  }
}

// Function to create a backup of the trades collection
async function backupTradesCollection() {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
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

// Main function to update symbols
async function updateSymbols() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';
    console.log(`Connecting to MongoDB at ${mongoUri}`);
    await connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Create a backup of the trades collection
    const backupSuccess = await backupTradesCollection();
    if (!backupSuccess) {
      console.error('Backup failed. Aborting update process for safety.');
      process.exit(1);
    }
    
    console.log('Backup successful. Proceeding with updates...');

    // Parse MIC file
    const micMapPath = path.resolve(__dirname, '../../Data/mic2.csv');
    const exchangeMap = await parseMICFile(micMapPath);
    console.log('Exchange map created with entries:', exchangeMap.size);

    // Find all trades with US symbols
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
      
      // Determine the new symbol with MIC
      const newSymbol = determineMIC(symbol, exchangeMap);
      
      if (newSymbol) {
        // Update the trade
        await TradeModel.updateOne(
          { _id: trade._id },
          { $set: { symbol: newSymbol } }
        );
        
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} trades so far`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} trades`);
    console.log(`Skipped ${skippedCount} trades`);
    console.log('\nBackup collection "trades_backup_before_mic_update" has been preserved.');
    console.log('If you need to restore the original data, run:');
    console.log('  mongosh mongodb://localhost:27017/ps2');
    console.log('  db.trades_backup_before_mic_update.aggregate([{ $match: {} }, { $out: "trades" }])');
  } catch (error) {
    console.error('Error updating symbols:', error);
    console.log('\nAttempting to recover from backup...');
    await recoverFromBackup();
  } finally {
    process.exit();
  }
}

// Function to recover from backup if something goes wrong
async function recoverFromBackup() {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
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

// Run the script
updateSymbols();