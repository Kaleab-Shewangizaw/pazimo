#!/usr/bin/env node

/**
 * ⚡ TICKET INDEX REBUILD SCRIPT
 * 
 * This script rebuilds all indexes on the Ticket collection for optimal performance
 * with 2000+ attendee events. Run this after deploying index changes.
 * 
 * Usage: node rebuild-ticket-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('./src/models/Ticket');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pazimo';

async function rebuildIndexes() {
  try {
    console.log('\n⚡ STARTING TICKET INDEX REBUILD');
    console.log('=====================================');
    
    // Connect to MongoDB
    console.log(`\n📡 Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(`📦 Collection: tickets`);

    // Get current ticket count
    const ticketCount = await Ticket.countDocuments();
    console.log(`\n🎫 Total tickets in database: ${ticketCount.toLocaleString()}`);

    // Drop all existing indexes (except _id which can't be dropped)
    console.log(`\n🗑️  Dropping existing indexes...`);
    try {
      await Ticket.collection.dropIndexes();
      console.log('✅ Old indexes dropped');
    } catch (error) {
      if (error.message.includes('ns not found')) {
        console.log('ℹ️  No existing indexes to drop');
      } else {
        throw error;
      }
    }

    // Rebuild all indexes from the schema
    console.log(`\n🏗️  Building new optimized indexes...`);
    const startTime = Date.now();
    
    await Ticket.createIndexes();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Indexes created in ${duration}ms`);

    // List all indexes
    console.log(`\n📋 Current indexes on Ticket collection:`);
    const indexes = await Ticket.collection.listIndexes().toArray();
    
    let indexNum = 0;
    for (const indexDef of indexes) {
      indexNum++;
      const keys = Object.entries(indexDef.key)
        .map(([field, order]) => `${field}:${order}`)
        .join(', ');
      
      const isUnique = indexDef.unique ? ' [UNIQUE]' : '';
      const isSparse = indexDef.sparse ? ' [SPARSE]' : '';
      
      console.log(`   ${indexNum}. ${indexDef.name}: { ${keys} }${isUnique}${isSparse}`);
    }

    console.log(`\n📊 Index Statistics:`);
    const stats = await Ticket.collection.stats();
    console.log(`   Total indexes: ${stats.nindexes}`);
    console.log(`   Total index size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Collection size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Test index performance with sample queries
    console.log(`\n🧪 Testing index performance...`);
    
    const tests = [
      {
        name: 'QR Code Lookup (by ticketId)',
        query: async () => {
          const result = await Ticket.findOne({ ticketId: 'test123' }).explain('executionStats');
          return result.executionStats;
        }
      },
      {
        name: 'Event Tickets List',
        query: async () => {
          // Use a real event ID if available
          const firstTicket = await Ticket.findOne().select('event').lean();
          if (firstTicket) {
            const result = await Ticket.find({ event: firstTicket.event })
              .sort({ createdAt: -1 })
              .limit(100)
              .explain('executionStats');
            return result.executionStats;
          }
          return null;
        }
      },
      {
        name: 'Check-in Filter',
        query: async () => {
          const firstTicket = await Ticket.findOne().select('event').lean();
          if (firstTicket) {
            const result = await Ticket.find({ 
              event: firstTicket.event, 
              checkedIn: false 
            }).explain('executionStats');
            return result.executionStats;
          }
          return null;
        }
      }
    ];

    for (const test of tests) {
      try {
        const stats = await test.query();
        if (stats) {
          const usedIndex = stats.executionStages?.indexName || 'COLLSCAN';
          const execTime = stats.executionTimeMillis;
          const docsExamined = stats.totalDocsExamined;
          const docsReturned = stats.nReturned;
          
          console.log(`\n   ${test.name}:`);
          console.log(`      Index used: ${usedIndex}`);
          console.log(`      Execution time: ${execTime}ms`);
          console.log(`      Docs examined: ${docsExamined}`);
          console.log(`      Docs returned: ${docsReturned}`);
          console.log(`      Efficiency: ${docsReturned > 0 ? (docsReturned / docsExamined * 100).toFixed(1) : 0}%`);
        }
      } catch (error) {
        console.log(`   ${test.name}: Skipped (${error.message})`);
      }
    }

    console.log(`\n✅ INDEX REBUILD COMPLETE!`);
    console.log(`=====================================\n`);
    
    console.log('📝 Performance Tips:');
    console.log('   - QR scanning should now be instant (<50ms)');
    console.log('   - Event ticket lists should load in <500ms even with 2000+ tickets');
    console.log('   - Use pagination (limit/skip) for large result sets');
    console.log('   - Monitor slow queries with MongoDB profiling\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB\n');
  }
}

// Run the script
rebuildIndexes();
