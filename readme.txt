# Monday.com AI Agent

A powerful AI agent that allows you to create and manage monday.com resources using natural language instructions.

## Features

- Create boards, columns, groups, and items using natural language
- Memory system to track created resources
- CLI and web interface
- Integration with OpenRouter.ai to use Google Gemma or other models
- LangChain agent for complex requests

## Installation

### Prerequisites

- Node.js (v16+)
- A monday.com account with API key
- An OpenRouter.ai account with API key

### Setup

1. Clone this repository
   ```
   git clone https://github.com/your-username/monday-ai-agent.git
   cd monday-ai-agent
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file with your API keys
   ```
   MONDAY_API_KEY=your_monday_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENROUTER_MODEL=google/gemma-7b-it  # Optional, defaults to google/gemma-7b-it
   PORT=3000  # Optional, defaults to 3000
   ```

## Usage

### CLI Mode

Run the agent in CLI mode:

```
node index.js
```

Commands:
- Type your natural language request directly
- `!langchain <request>` - Use LangChain agent for complex requests
- `!server` - Start the web server
- `!exit` - Exit the program

### Web Interface

Start the web server:

```
node index.js --server
```

Then open your browser to `http://localhost:3000` to access the web interface.

### Example Requests

Here are some examples of what you can ask the agent to do:

- "Create a task management board with status, assignee, and due date columns"
- "Create a project board with planning, execution, and review groups"
- "Create a board named 'Marketing Campaigns' with status, budget, and timeline columns"
- "Add an item called 'Q2 Social Media Campaign' to my Marketing Campaigns board with a 'Working on it' status"

## Architecture

This project uses the following components:

- **mondayClient.js**: API client for monday.com GraphQL API
- **llmService.js**: Service for generating responses with OpenRouter/Gemma
- **agent.js**: Main agent logic for processing requests
- **memoryService.js**: Memory system for tracking created resources
- **server.js**: Express server for web interface
- **index.js**: Command-line interface

## Advanced Configuration

### Using Different Models

You can change the model used by setting the `OPENROUTER_MODEL` environment variable. Some options:

- `google/gemma-7b-it` (default)
- `anthropic/claude-3-haiku-20240307`
- `mistralai/mistral-7b-instruct`

### Memory Persistence

The agent's memory is stored in a file called `memory.json`. You can back this up or modify it directly if needed.

## Troubleshooting

- **Authentication Errors**: Make sure your monday.com API key has the necessary permissions.
- **Rate Limiting**: The monday.com API has rate limits. If you hit them, the agent will report an error.
- **Model Errors**: If the AI model fails, try using a different model or simplifying your request.

## License

MIT

## Contributions

Contributions are welcome! Please feel free to submit a Pull Request.
