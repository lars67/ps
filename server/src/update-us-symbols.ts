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
  mic: string;
}

// Function to parse the MIC CSV file
async function parseMICFile(filePath: string): Promise<Map<string, string>> {
  const micMap = new Map<string, string>();
  
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
    const mic = columns[4];

    // We're only interested in US exchanges: XNAS, XNYS, OTCM
    if (country === 'UNITED STATES OF AMERICA') {
      if (mic === 'XNAS' || mic === 'XNYS' || mic === 'OTCM') {
        console.log(`Found US exchange: ${mic}`);
        micMap.set(mic, mic);
      }
    }
  }

  console.log('Finished parsing MIC file');
  return micMap;
}

// Function to determine which MIC a US symbol belongs to
// This is a simplified approach - in a real scenario, you might need more sophisticated logic
async function determineMIC(symbol: string): Promise<string | null> {
  try {
    // This is where you would implement logic to determine which exchange a symbol belongs to
    // For this example, we'll use a simple approach based on common patterns
    
    // For demonstration purposes:
    // - Assume most common stocks are on NASDAQ (XNAS)
    // - Stocks with 1-3 letters are often on NYSE (XNYS)
    // - Stocks ending with .PK are on OTC Markets (OTCM)
    
    if (symbol.endsWith('.PK')) {
      return 'OTCM';
    } else if (symbol.length <= 3) {
      return 'XNYS';
    } else {
      return 'XNAS'; // Default to NASDAQ for most symbols
    }
    
    // In a production environment, you would want to use a more accurate method:
    // 1. Query an API that provides exchange information
    // 2. Use a comprehensive mapping table
    // 3. Query another database with this information
  } catch (error) {
    console.error(`Error determining MIC for symbol ${symbol}:`, error);
    return null;
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

    // Parse MIC file
    const micMapPath = path.resolve(__dirname, '../../Data/mic2.csv');
    const micMap = await parseMICFile(micMapPath);
    console.log('MIC map:', micMap);

    // Find all trades with US symbols (simplified approach)
    // In a real scenario, you might need more sophisticated filtering
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
    for (const trade of trades) {
      const symbol = trade.symbol;
      
      // Skip if symbol is not a string or is empty
      if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
        continue;
      }
      
      // Skip if symbol already has a MIC format
      if (symbol.includes(':XNAS') || symbol.includes(':XNYS') || symbol.includes(':OTCM')) {
        continue;
      }
      
      // Skip FX symbols
      if (symbol.endsWith(':FX')) {
        continue;
      }
      
      // Determine which MIC this symbol belongs to
      const mic = await determineMIC(symbol);
      
      if (mic && micMap.has(mic)) {
        // Create the new symbol format
        const newSymbol = `${symbol}:${mic}`;
        
        // Update the trade
        await TradeModel.updateOne(
          { _id: trade._id },
          { $set: { symbol: newSymbol } }
        );
        
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} trades so far`);
        }
      }
    }

    console.log(`Successfully updated ${updatedCount} trades`);
  } catch (error) {
    console.error('Error updating symbols:', error);
  } finally {
    process.exit();
  }
}

// Run the script
updateSymbols();