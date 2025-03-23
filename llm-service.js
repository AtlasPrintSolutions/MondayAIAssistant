// llmService.js
const { OpenRouterChat } = require('@langchain/openrouter');
require('dotenv').config();

class LLMService {
  constructor() {
    this.model = new OpenRouterChat({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.OPENROUTER_MODEL || "google/gemma-7b-it", // Default to Gemma 7B
      temperature: 0.2, // Lower temperature for more deterministic outputs
      maxTokens: 1500, // Set a reasonable max token limit
    });
    
    // Fallback model in case primary fails
    this.fallbackModel = new OpenRouterChat({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: "anthropic/claude-3-haiku-20240307", // Fallback to Claude 3 Haiku
      temperature: 0.2,
      maxTokens: 1500,
    });
  }

  // Generate a free-form response
  async generateResponse(prompt, systemPrompt = null) {
    try {
      const messages = [];
      
      if (systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt
        });
      }
      
      messages.push({
        role: "user",
        content: prompt
      });
      
      const response = await this.model.invoke(messages);
      return response.content;
    } catch (error) {
      console.error("Error generating response with primary model:", error);
      
      // Try fallback model
      try {
        console.log("Trying fallback model...");
        const messages = [];
        
        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt
          });
        }
        
        messages.push({
          role: "user",
          content: prompt
        });
        
        const fallbackResponse = await this.fallbackModel.invoke(messages);
        return fallbackResponse.content;
      } catch (fallbackError) {
        console.error("Error with fallback model:", fallbackError);
        throw error; // Throw the original error
      }
    }
  }

  // Generate a structured response according to a schema
  async generateStructuredResponse(prompt, schema, systemPrompt = null) {
    const combinedPrompt = `
${prompt}

You MUST respond with a valid JSON object that conforms to the following schema:
${JSON.stringify(schema, null, 2)}

Do not include any explanations or notes outside the JSON. Only respond with the JSON object.
`;

    const response = await this.generateResponse(combinedPrompt, systemPrompt);
    
    try {
      // Find JSON in the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/{[\s\S]*?}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonString);
      } else {
        // Attempt to parse the full response as JSON
        return JSON.parse(response);
      }
    } catch (error) {
      console.error("Error parsing LLM response as JSON:", error);
      console.error("Raw response:", response);
      throw new Error("Failed to generate a valid structured response");
    }
  }

  // Process a request and return actions to take
  async processRequest(userInput) {
    const schema = {
      type: "object",
      properties: {
        resourceType: {
          type: "string",
          enum: ["board", "item", "column", "group", "automation", "webhook"]
        },
        operation: {
          type: "string",
          enum: ["create", "update", "delete", "get"]
        },
        attributes: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            boardKind: { type: "string" },
            workspaceId: { type: "string" },
            boardId: { type: "string" },
            groupId: { type: "string" },
            itemId: { type: "string" },
            columnType: { type: "string" },
            columns: { 
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  type: { type: "string" }
                }
              }
            },
            columnValues: { type: "object" }
          }
        },
        steps: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["resourceType", "operation", "attributes"]
    };

    const systemPrompt = `
You are an AI assistant that helps create resources in monday.com.
Your job is to analyze user requests and convert them into structured actions.
Be precise and focus on extracting the exact details needed to fulfill the request.
`;

    const prompt = `
Analyze the following request and break it down into specific actions:

User request: "${userInput}"

Extract the information needed to create resources in monday.com.
Determine what type of resource needs to be created (board, item, column, group, etc.) and what attributes it needs.

For column types, use one of: "text", "long_text", "numbers", "status", "dropdown", "people", "date", "file", "link", "timeline".
`;

    return await this.generateStructuredResponse(prompt, schema, systemPrompt);
  }
}

module.exports = new LLMService();
