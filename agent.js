// agent.js
const mondayClient = require('./mondayClient');
const llmService = require('./llmService');
const memoryService = require('./memoryService');
const { DynamicTool } = require('langchain/tools');
const { createOpenRouterAgent, AgentExecutor } = require('langchain/agents');
const { OpenRouterChat } = require('@langchain/openrouter');
require('dotenv').config();

class MondayAgent {
  constructor() {
    this.mondayClient = mondayClient;
    this.llm = llmService;
    this.langchainAgent = null;
    this.setupPromise = this.setupLangchainAgent();
  }

  async setupLangchainAgent() {
    const model = new OpenRouterChat({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "google/gemma-7b-it",
      temperature: 0.2,
    });

    // Define tools for the agent
    const tools = [
      new DynamicTool({
        name: 'GetBoards',
        description: 'Get a list of boards from monday.com',
        func: async () => {
          const result = await this.mondayClient.getBoards();
          return JSON.stringify(result.data.boards);
        },
      }),
      new DynamicTool({
        name: 'GetBoard',
        description: 'Get a specific board by ID. Input should be the board ID.',
        func: async (boardId) => {
          const result = await this.mondayClient.getBoardById(boardId);
          return JSON.stringify(result.data.boards[0]);
        },
      }),
      new DynamicTool({
        name: 'CreateBoard',
        description: 'Create a new board. Input should be a JSON string with name, boardKind, and optionally workspaceId.',
        func: async (input) => {
          const params = JSON.parse(input);
          const result = await this.mondayClient.createBoard(
            params.name,
            params.boardKind || 'public',
            params.workspaceId || null
          );
          return JSON.stringify(result.data.create_board);
        },
      }),
      new DynamicTool({
        name: 'CreateColumn',
        description: 'Create a new column in a board. Input should be a JSON string with boardId, title, and columnType.',
        func: async (input) => {
          const params = JSON.parse(input);
          const result = await this.mondayClient.createColumn(
            params.boardId,
            params.title,
            params.columnType
          );
          return JSON.stringify(result.data.create_column);
        },
      }),
      new DynamicTool({
        name: 'CreateGroup',
        description: 'Create a new group in a board. Input should be a JSON string with boardId and groupName.',
        func: async (input) => {
          const params = JSON.parse(input);
          const result = await this.mondayClient.createGroup(
            params.boardId,
            params.groupName
          );
          return JSON.stringify(result.data.create_group);
        },
      }),
      new DynamicTool({
        name: 'CreateItem',
        description: 'Create a new item in a board or group. Input should be a JSON string with boardId, itemName, optionally groupId, and optionally columnValues.',
        func: async (input) => {
          const params = JSON.parse(input);
          const result = await this.mondayClient.createItem(
            params.boardId,
            params.itemName,
            params.groupId || null,
            params.columnValues || {}
          );
          return JSON.stringify(result.data.create_item);
        },
      }),
      new DynamicTool({
        name: 'FormatColumnValue',
        description: 'Format a column value for a specific column type. Input should be a JSON string with type and value.',
        func: async (input) => {
          const params = JSON.parse(input);
          return this.mondayClient.formatColumnValue(params.type, params.value);
        },
      }),
    ];

    // Initialize the agent
    try {
      this.langchainAgent = await createOpenRouterAgent({
        llm: model,
        tools,
        verbose: true,
      });

      // Create the agent executor
      this.agentExecutor = new AgentExecutor({
        agent: this.langchainAgent,
        tools,
        verbose: true,
        maxIterations: 5,
      });

      console.log("LangChain agent successfully initialized");
    } catch (error) {
      console.error("Error initializing LangChain agent:", error);
      this.langchainAgent = null;
    }
  }

  // Process a user request using the simpler approach
  async processRequest(userInput) {
    // Step 1: Get recent context for enhanced understanding
    const recentCreations = await memoryService.getRecentCreations(5);
    
    // Enhanced prompt with context about recent actions
    let contextPrompt = "";
    if (recentCreations.length > 0) {
      contextPrompt = `\nRecently created resources:\n${
        recentCreations.map(c => `- ${c.type}: "${c.name}" (id: ${c.id})`).join('\n')
      }\n\nYou can refer to these resources in your instructions if relevant.`;
    }
    
    // Step 2: Understand the user's request using the LLM
    try {
      // Add the context to the user input for better understanding
      const enhancedInput = contextPrompt ? `${userInput}\n${contextPrompt}` : userInput;
      
      const plan = await this.llm.processRequest(enhancedInput);
      console.log("Generated plan:", JSON.stringify(plan, null, 2));
      
      // Step 3: Execute the plan
      return await this.executePlan(plan, userInput);
    } catch (error) {
      console.error("Error processing request:", error);
      const errorResult = {
        success: false,
        message: `Error processing request: ${error.message}`,
      };
      
      // Still store the failed attempt
      await memoryService.storeConversation(userInput, errorResult);
      
      return errorResult;
    }
  }

  // Process a user request using LangChain agent if available
  async processRequestWithLangChain(userInput) {
    await this.setupPromise; // Ensure agent is initialized
    
    if (!this.langchainAgent) {
      console.log("Falling back to simple processing method");
      return this.processRequest(userInput);
    }
    
    try {
      const result = await this.agentExecutor.invoke({
        input: userInput,
      });
      
      return {
        success: true,
        message: "Successfully processed your request with LangChain agent",
        result: result.output,
        agentSteps: result.intermediateSteps?.map(step => ({
          tool: step.action.tool,
          input: step.action.toolInput,
          output: step.observation,
        })),
      };
    } catch (error) {
      console.error("Error with LangChain agent:", error);
      console.log("Falling back to simple processing method");
      return this.processRequest(userInput);
    }
  }

  async executePlan(plan, userInput) {
    const results = {
      success: true,
      message: "Successfully processed your request",
      details: []
    };

    try {
      // Handle different resource types
      switch (plan.resourceType) {
        case "board":
          await this.handleBoardOperation(plan, results);
          break;
          
        case "column":
          await this.handleColumnOperation(plan, results);
          break;
          
        case "item":
          await this.handleItemOperation(plan, results);
          break;
          
        case "group":
          await this.handleGroupOperation(plan, results);
          break;
          
        default:
          results.success = false;
          results.message = `Unsupported resource type: ${plan.resourceType}`;
      }
      
      // Store the conversation and results in memory
      if (userInput) {
        await memoryService.storeConversation(userInput, results);
      }
      
      // Store created resources in memory
      if (results.details && results.details.length > 0) {
        for (const detail of results.details) {
          if (detail.id) {
            await memoryService.storeResource(
              detail.type, 
              detail,
              `request_${Date.now()}`  // Store with a unique context ID
            );
          }
        }
      }
    } catch (error) {
      results.success = false;
      results.message = `Error executing plan: ${error.message}`;
      console.error(error);
    }
    
    return results;
  }

  async handleBoardOperation(plan, results) {
    const { operation, attributes } = plan;
    
    switch (operation) {
      case "create":
        const boardResponse = await this.mondayClient.createBoard(
          attributes.name,
          attributes.boardKind || "public",
          attributes.workspaceId
        );
        
        const boardId = boardResponse.data.create_board.id;
        
        results.details.push({
          type: "board",
          operation: "create",
          id: boardId,
          name: boardResponse.data.create_board.name
        });
        
        // If columns are specified, create them
        if (attributes.columns && attributes.columns.length > 0) {
          for (const column of attributes.columns) {
            await this.createColumn(boardId, column, results);
          }
        }
        break;
        
      case "get":
        const getResponse = await this.mondayClient.getBoardById(attributes.boardId);
        results.details.push({
          type: "board",
          operation: "get",
          board: getResponse.data.boards[0]
        });
        break;
        
      default:
        throw new Error(`Unsupported board operation: ${operation}`);
    }
  }

  async createColumn(boardId, column, results) {
    try {
      const columnResponse = await this.mondayClient.createColumn(
        boardId,
        column.title,
        column.type
      );
      
      results.details.push({
        type: "column",
        operation: "create",
        id: columnResponse.data.create_column.id,
        title: columnResponse.data.create_column.title,
        boardId: boardId
      });
    } catch (error) {
      results.details.push({
        type: "column",
        operation: "create",
        error: error.message,
        title: column.title,
        boardId: boardId
      });
    }
  }

  async handleColumnOperation(plan, results) {
    const { operation, attributes } = plan;
    
    switch (operation) {
      case "create":
        await this.createColumn(
          attributes.boardId,
          { title: attributes.name, type: attributes.columnType },
          results
        );
        break;
        
      default:
        throw new Error(`Unsupported column operation: ${operation}`);
    }
  }

  async handleItemOperation(plan, results) {
    const { operation, attributes } = plan;
    
    switch (operation) {
      case "create":
        const itemResponse = await this.mondayClient.createItem(
          attributes.boardId,
          attributes.name,
          attributes.groupId,
          attributes.columnValues || {}
        );
        
        results.details.push({
          type: "item",
          operation: "create",
          id: itemResponse.data.create_item.id,
          name: itemResponse.data.create_item.name,
          boardId: attributes.boardId
        });
        break;
        
      case "update":
        const updateResponse = await this.mondayClient.updateItem(
          attributes.itemId,
          attributes.boardId,
          attributes.columnValues || {}
        );
        
        results.details.push({
          type: "item",
          operation: "update",
          id: updateResponse.data.change_multiple_column_values.id,
          name: updateResponse.data.change_multiple_column_values.name,
          boardId: attributes.boardId
        });
        break;
        
      default:
        throw new Error(`Unsupported item operation: ${operation}`);
    }
  }

  async handleGroupOperation(plan, results) {
    const { operation, attributes } = plan;
    
    switch (operation) {
      case "create":
        const groupResponse = await this.mondayClient.createGroup(
          attributes.boardId,
          attributes.name
        );
        
        results.details.push({
          type: "group",
          operation: "create",
          id: groupResponse.data.create_group.id,
          title: groupResponse.data.create_group.title,
          boardId: attributes.boardId
        });
        break;
        
      default:
        throw new Error(`Unsupported group operation: ${operation}`);
    }
  }
}

module.exports = new MondayAgent();
