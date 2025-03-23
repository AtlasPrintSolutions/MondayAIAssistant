// memoryService.js
const fs = require('fs').promises;
const path = require('path');

class MemoryService {
  constructor() {
    this.memoryFilePath = path.join(__dirname, 'memory.json');
    this.memory = {
      conversations: [],
      resources: {
        boards: {},
        items: {},
        groups: {},
        columns: {}
      },
      contexts: {}
    };
    this.initialized = false;
    this.initPromise = this.init();
  }

  async init() {
    try {
      const data = await fs.readFile(this.memoryFilePath, 'utf8');
      this.memory = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid, create it
      await this.saveMemory();
    }
    this.initialized = true;
  }

  async saveMemory() {
    await fs.writeFile(
      this.memoryFilePath,
      JSON.stringify(this.memory, null, 2),
      'utf8'
    );
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  // Store information about a conversation
  async storeConversation(userInput, result) {
    await this.ensureInitialized();
    
    const conversation = {
      timestamp: new Date().toISOString(),
      userInput,
      result,
      success: result.success
    };
    
    this.memory.conversations.unshift(conversation);
    
    // Limit to last 100 conversations
    if (this.memory.conversations.length > 100) {
      this.memory.conversations = this.memory.conversations.slice(0, 100);
    }
    
    await this.saveMemory();
    return conversation;
  }

  // Store a created resource
  async storeResource(type, data, context = null) {
    await this.ensureInitialized();
    
    if (!this.memory.resources[type]) {
      this.memory.resources[type] = {};
    }
    
    this.memory.resources[type][data.id] = {
      ...data,
      timestamp: new Date().toISOString()
    };
    
    // If a context is provided, store this resource in that context
    if (context) {
      if (!this.memory.contexts[context]) {
        this.memory.contexts[context] = {
          resources: {},
          timestamp: new Date().toISOString()
        };
      }
      
      if (!this.memory.contexts[context].resources[type]) {
        this.memory.contexts[context].resources[type] = {};
      }
      
      this.memory.contexts[context].resources[type][data.id] = data;
    }
    
    await this.saveMemory();
    return data;
  }

  // Get all resources of a specific type
  async getResources(type) {
    await this.ensureInitialized();
    return this.memory.resources[type] || {};
  }

  // Get a specific resource by ID
  async getResource(type, id) {
    await this.ensureInitialized();
    return this.memory.resources[type]?.[id];
  }

  // Find resources by name (partial match)
  async findResourcesByName(type, name) {
    await this.ensureInitialized();
    
    const resources = this.memory.resources[type] || {};
    const results = [];
    
    for (const id in resources) {
      const resource = resources[id];
      const resourceName = resource.name || resource.title || '';
      
      if (resourceName.toLowerCase().includes(name.toLowerCase())) {
        results.push(resource);
      }
    }
    
    return results;
  }

  // Get all resources for a specific context
  async getContextResources(context) {
    await this.ensureInitialized();
    return this.memory.contexts[context] || null;
  }

  // Store a context with arbitrary data
  async storeContext(name, data) {
    await this.ensureInitialized();
    
    this.memory.contexts[name] = {
      ...data,
      timestamp: new Date().toISOString()
    };
    
    await this.saveMemory();
    return this.memory.contexts[name];
  }

  // Get recent conversations
  async getRecentConversations(limit = 10) {
    await this.ensureInitialized();
    return this.memory.conversations.slice(0, limit);
  }

  // Get recent successful creations
  async getRecentCreations(limit = 10) {
    await this.ensureInitialized();
    
    const creations = [];
    
    for (const conversation of this.memory.conversations) {
      if (conversation.success && conversation.result.details) {
        for (const detail of conversation.result.details) {
          if (detail.operation === 'create' || !detail.operation) {
            creations.push({
              type: detail.type,
              id: detail.id,
              name: detail.name || detail.title,
              timestamp: conversation.timestamp,
              userInput: conversation.userInput
            });
          }
        }
      }
      
      if (creations.length >= limit) {
        break;
      }
    }
    
    return creations;
  }

  // Clear all memory
  async clearMemory() {
    this.memory = {
      conversations: [],
      resources: {
        boards: {},
        items: {},
        groups: {},
        columns: {}
      },
      contexts: {}
    };
    
    await this.saveMemory();
    return true;
  }
}

module.exports = new MemoryService();
