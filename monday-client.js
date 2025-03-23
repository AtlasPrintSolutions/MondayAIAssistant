// mondayClient.js
const axios = require('axios');
require('dotenv').config();

class MondayClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.monday.com/v2';
    this.cachedBoards = null;
    this.cachedWorkspaces = null;
  }

  async query(queryStr, variables = {}) {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          query: queryStr,
          variables: variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': this.apiKey
          }
        }
      );
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.error('GraphQL Errors:', response.data.errors);
        throw new Error(`GraphQL Error: ${response.data.errors[0].message}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error executing query:', error.response?.data || error.message);
      throw error;
    }
  }

  // Get account information
  async getMe() {
    const query = `query { me { id name email } }`;
    return this.query(query);
  }

  // Get list of workspaces
  async getWorkspaces() {
    if (this.cachedWorkspaces) return this.cachedWorkspaces;
    
    const query = `query { workspaces { id name kind description } }`;
    const result = await this.query(query);
    this.cachedWorkspaces = result;
    return result;
  }

  // Get list of boards
  async getBoards(limit = 100) {
    if (this.cachedBoards) return this.cachedBoards;
    
    const query = `
      query {
        boards(limit: ${limit}) {
          id
          name
          description
          board_kind
          board_folder_id
          items_count
          workspace_id
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;
    const result = await this.query(query);
    this.cachedBoards = result;
    return result;
  }

  // Get a specific board by ID
  async getBoardById(boardId) {
    const query = `
      query {
        boards(ids: ${boardId}) {
          id
          name
          description
          board_kind
          items_count
          workspace_id
          columns {
            id
            title
            type
            settings_str
          }
          groups {
            id
            title
            color
            position
          }
          items {
            id
            name
            group {
              id
              title
            }
            column_values {
              id
              text
              type
              value
            }
          }
        }
      }
    `;
    return this.query(query);
  }

  // Create a new board
  async createBoard(name, boardKind = "public", workspaceId = null, templateId = null) {
    let query = `
      mutation ($boardName: String!, $boardKind: BoardKind!) {
        create_board(board_name: $boardName, board_kind: $boardKind
    `;
    
    // Add optional parameters if provided
    if (workspaceId) {
      query += `, workspace_id: ${workspaceId}`;
    }
    
    if (templateId) {
      query += `, template_id: ${templateId}`;
    }
    
    query += `) {
          id
          name
          board_kind
        }
      }
    `;
    
    const variables = {
      boardName: name,
      boardKind: boardKind
    };
    
    return this.query(query, variables);
  }

  // Create a board from a template
  async createBoardFromTemplate(name, templateId, workspaceId = null) {
    return this.createBoard(name, "public", workspaceId, templateId);
  }

  // Create columns on a board
  async createColumn(boardId, title, columnType) {
    const query = `
      mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) {
        create_column(board_id: $boardId, title: $title, column_type: $columnType) {
          id
          title
          type
        }
      }
    `;
    
    const variables = {
      boardId: boardId.toString(),
      title,
      columnType
    };
    
    return this.query(query, variables);
  }

  // Create a group in a board
  async createGroup(boardId, groupName) {
    const query = `
      mutation ($boardId: ID!, $groupName: String!) {
        create_group(board_id: $boardId, group_name: $groupName) {
          id
          title
        }
      }
    `;
    
    const variables = {
      boardId: boardId.toString(),
      groupName
    };
    
    return this.query(query, variables);
  }

  // Create an item in a group
  async createItem(boardId, itemName, groupId = null, columnValues = {}) {
    let query = `
      mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON`;
      
    if (groupId) {
      query += `, $groupId: String!`;
    }
    
    query += `) {
        create_item(
          board_id: $boardId, 
          item_name: $itemName, 
          column_values: $columnValues`;
          
    if (groupId) {
      query += `, group_id: $groupId`;
    }
    
    query += `) {
          id
          name
        }
      }
    `;
    
    const variables = {
      boardId: boardId.toString(),
      itemName,
      columnValues: JSON.stringify(columnValues)
    };
    
    if (groupId) {
      variables.groupId = groupId;
    }

    return this.query(query, variables);
  }

  // Update an item
  async updateItem(itemId, boardId, columnValues = {}) {
    const query = `
      mutation ($itemId: ID!, $boardId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          item_id: $itemId, 
          board_id: $boardId, 
          column_values: $columnValues
        ) {
          id
          name
          column_values {
            id
            text
            value
          }
        }
      }
    `;
    
    const variables = {
      itemId: itemId.toString(),
      boardId: boardId.toString(),
      columnValues: JSON.stringify(columnValues)
    };

    return this.query(query, variables);
  }

  // Get all board templates
  async getBoardTemplates() {
    const query = `
      query {
        boards(state: templates) {
          id
          name
          description
          board_kind
        }
      }
    `;
    return this.query(query);
  }

  // Helper to format column values for different column types
  formatColumnValue(type, value) {
    switch (type) {
      case 'status':
        return JSON.stringify({ index: parseInt(value) });
      case 'person':
        return JSON.stringify({ id: value });
      case 'date':
        return JSON.stringify({ date: value }); // YYYY-MM-DD
      case 'dropdown':
        return JSON.stringify({ ids: [value] });
      case 'numbers':
        return value.toString();
      case 'text':
        return value;
      case 'long_text':
        return JSON.stringify({ text: value });
      case 'checkbox':
        return JSON.stringify({ checked: value === true || value === 'true' ? "true" : "false" });
      default:
        return JSON.stringify(value);
    }
  }

  // Create a webhook
  async createWebhook(boardId, url, event, config = {}) {
    const query = `
      mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!, $config: JSON) {
        create_webhook(board_id: $boardId, url: $url, event: $event, config: $config) {
          id
          board_id
        }
      }
    `;
    
    const variables = {
      boardId: boardId.toString(),
      url,
      event,
      config: JSON.stringify(config)
    };

    return this.query(query, variables);
  }

  // Get available automations
  async getAutomations(boardId) {
    const query = `
      query {
        boards (ids: ${boardId}) {
          automation {
            trigger_types
            action_types
          }
        }
      }
    `;
    return this.query(query);
  }

  // Clear the cache
  clearCache() {
    this.cachedBoards = null;
    this.cachedWorkspaces = null;
  }
}

module.exports = new MondayClient(process.env.MONDAY_API_KEY);
