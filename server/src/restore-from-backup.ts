import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function restoreFromBackup() {
  try {
    // Connect to PS2 database
    const ps2Uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ps2';
    console.log(`Connecting to PS2 database at ${ps2Uri}`);
    await mongoose.connect(ps2Uri);
    const db = mongoose.connection.db;
    console.log('Connected to PS2 database');
    
    // Check if backup collection exists
    const collections = await db.listCollections({ name: 'trades_backup_before_mic_update' }).toArray();
    if (collections.length === 0) {
      console.error('No backup collection found. Cannot restore.');
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
  } finally {
    await mongoose.disconnect();
  }
}

// Run the restore function
restoreFromBackup().then(() => {
  console.log('Restore process completed.');
  process.exit(0);
}).catch(err => {
  console.error('Restore process failed:', err);
  process.exit(1);
});