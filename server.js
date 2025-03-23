// server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mondayAgent = require('./agent');
const memoryService = require('./memoryService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to process requests
app.post('/api/process', async (req, res) => {
  try {
    const { userInput, useLangChain } = req.body;
    
    if (!userInput) {
      return res.status(400).json({
        success: false,
        message: 'User input is required'
      });
    }
    
    console.log(`Processing request: "${userInput}"`);
    console.log(`Using LangChain: ${useLangChain ? 'Yes' : 'No'}`);
    
    let result;
    if (useLangChain) {
      result = await mondayAgent.processRequestWithLangChain(userInput);
    } else {
      result = await mondayAgent.processRequest(userInput);
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Error processing request:', error);
    return res.status(500).json({
      success: false,
      message: `Error processing request: ${error.message}`
    });
  }
});

// API endpoint to get boards
app.get('/api/boards', async (req, res) => {
  try {
    const result = await mondayAgent.mondayClient.getBoards();
    return res.json(result);
  } catch (error) {
    console.error('Error getting boards:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting boards: ${error.message}`
    });
  }
});

// API endpoint to get workspaces
app.get('/api/workspaces', async (req, res) => {
  try {
    const result = await mondayAgent.mondayClient.getWorkspaces();
    return res.json(result);
  } catch (error) {
    console.error('Error getting workspaces:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting workspaces: ${error.message}`
    });
  }
});

// API endpoint to get recent conversations
app.get('/api/memory/conversations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const conversations = await memoryService.getRecentConversations(limit);
    return res.json({ success: true, conversations });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting conversations: ${error.message}`
    });
  }
});

// API endpoint to get recent creations
app.get('/api/memory/creations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const creations = await memoryService.getRecentCreations(limit);
    return res.json({ success: true, creations });
  } catch (error) {
    console.error('Error getting creations:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting creations: ${error.message}`
    });
  }
});

// API endpoint to get resources of a specific type
app.get('/api/memory/resources/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const resources = await memoryService.getResources(type);
    return res.json({ success: true, resources });
  } catch (error) {
    console.error(`Error getting ${req.params.type} resources:`, error);
    return res.status(500).json({
      success: false,
      message: `Error getting resources: ${error.message}`
    });
  }
});

// API endpoint to clear memory
app.post('/api/memory/clear', async (req, res) => {
  try {
    await memoryService.clearMemory();
    return res.json({ success: true, message: 'Memory cleared successfully' });
  } catch (error) {
    console.error('Error clearing memory:', error);
    return res.status(500).json({
      success: false,
      message: `Error clearing memory: ${error.message}`
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
