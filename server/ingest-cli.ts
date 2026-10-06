import { crawlJjcetWebsite } from './ingestion/crawler.js';
import { vectorStore } from './rag/vectorStore.js';

async function runIngestion() {
  console.log('====================================================');
  console.log('   JJCET AI ASSISTANT - KNOWLEDGE INGESTION PIPELINE');
  console.log('   Target: Official JJCET Website (https://jjcet.ac.in/)');
  console.log('====================================================\n');

  const startTime = Date.now();

  try {
    const data = await crawlJjcetWebsite();

    console.log('\n💾 Saving structured persistent knowledge index...');
    vectorStore.saveIndex(data.chunks, data.faculty, data.courses, data.pageCount);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Ingestion completed successfully in ${duration}s!`);
    console.log('You can now run: npm run dev to start the assistant.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Ingestion failed:', err);
    process.exit(1);
  }
}

runIngestion();
