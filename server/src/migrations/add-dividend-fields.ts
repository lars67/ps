/**
 * Migration script to add dividend-related fields to existing portfolios
 * Run this script once after deploying the schema changes
 */

import * as dotenv from "dotenv";
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';
dotenv.config();

import { connect, connection } from "mongoose";
import { PortfolioModel } from '../models/portfolio';
import logger from '../utils/logger';

export async function migrateDividendFields() {
  let mongooseConnection = null;

  try {
    logger.log('Starting dividend fields migration...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ps2';
    logger.log(`Connecting to MongoDB: ${mongoUri}`);

    mongooseConnection = await connect(mongoUri);

    logger.log('Connected to MongoDB successfully');

    // Update all portfolios that don't have bookDividends field
    const result = await PortfolioModel.updateMany(
      { bookDividends: { $exists: false } },
      {
        $set: {
          bookDividends: true,
          lastDividendCheck: null
        }
      }
    );

    logger.log(`Migration completed. Updated ${result.modifiedCount} portfolios.`);

    // Log summary
    const totalPortfolios = await PortfolioModel.countDocuments();
    const portfoliosWithAutoBooking = await PortfolioModel.countDocuments({ bookDividends: true });

    logger.log(`Total portfolios: ${totalPortfolios}`);
    logger.log(`Portfolios with auto dividend booking enabled: ${portfoliosWithAutoBooking}`);

    return {
      success: true,
      modifiedCount: result.modifiedCount,
      totalPortfolios,
      portfoliosWithAutoBooking
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Migration failed: ${errorMessage}`);
    return {
      success: false,
      error: errorMessage
    };
  } finally {
    // Close the connection
    if (mongooseConnection) {
      await mongooseConnection.disconnect();
      logger.log('Disconnected from MongoDB');
    }
  }
}

// If run directly
if (require.main === module) {
  migrateDividendFields()
    .then((result) => {
      console.log('Migration result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
