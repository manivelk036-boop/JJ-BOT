import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { vectorStore } from './rag/vectorStore.js';
import { analyzeIntent } from './rag/intent.js';
import { executeHybridSearch } from './rag/hybridSearch.js';
import { generateGroundedAnswer } from './ai/gemini.js';
import { sanitizeText, sanitizeSourceTitle } from './ai/sanitizer.js';
import { ChatResponse } from './types.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Status & Index Health
app.get('/api/status', (req, res) => {
  const index = vectorStore.getIndex();
  res.json({
    status: 'online',
    indexed: vectorStore.isLoaded(),
    chunkCount: index?.chunkCount || 0,
    facultyCount: index?.facultyMembers.length || 0,
    courseCount: index?.courses.length || 0,
    lastIndexed: index?.indexedAt || null,
  });
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (!vectorStore.isLoaded()) {
      return res.status(503).json({
        error: 'Knowledge base is not yet indexed. Please run npm run ingest first.',
      });
    }

    // 1. Analyze Intent & Extract Entities
    const analysis = analyzeIntent(message);

    // 2. Hybrid Retrieval
    const retrieval = executeHybridSearch(analysis);

    const contextText = retrieval.relevantChunks
      .map((c, i) => `[Context ${i + 1} - ${c.metadata.pageTitle} (${c.metadata.sourceUrl})]:\n${c.content}`)
      .join('\n\n');

    console.log('=== CHAT REQUEST LOG ===');
    console.log('query:', message);
    console.log('detected intent:', analysis.intent);
    console.log('retrieved chunk IDs:', retrieval.relevantChunks.map(c => c.id));
    console.log('context actually passed to Gemini/answer generator:\n', contextText);

    // 3. Grounded Answer Generation
    const answer = await generateGroundedAnswer(message, retrieval);
    console.log('final generated answer before frontend rendering:\n', answer);

    // 4. Return clean response with source citations
    const sanitizedAnswer = sanitizeText(answer);
    console.log('final sanitized answer:\n', sanitizedAnswer);
    console.log('========================');

    const response: ChatResponse = {
      answer: sanitizedAnswer,
      sources: retrieval.sources.map(s => ({
        title: sanitizeSourceTitle(s.title),
        url: s.url,
        department: s.department,
      })),
      intent: analysis.intent,
      department: analysis.department,
    };

    res.json(response);
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({
      error: 'An internal error occurred while processing your request.',
      details: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 JJCET AI Assistant Backend running at http://localhost:${PORT}`);
  console.log(`📊 Index status: ${vectorStore.isLoaded() ? 'Loaded' : 'Not Loaded (Run npm run ingest)'}`);
});
