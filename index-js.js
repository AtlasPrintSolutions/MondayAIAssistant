// index.js
require('dotenv').config();
const readline = require('readline');
const mondayAgent = require('./agent');

// Check for required environment variables
const requiredEnvVars = ['MONDAY_API_KEY', 'OPENROUTER_API_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please add them to your .env file');
  process.exit(1);
}

// Check command-line arguments
const args = process.argv.slice(2);

// Start server mode if --server flag is provided
if (args.includes('--server')) {
  console.log('Starting server...');
  require('./server');
  return;
}

// CLI mode
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('===============================================');
console.log('Monday.com AI Agent - CLI Mode');
console.log('===============================================');
console.log('Type your request or enter these commands:');
console.log('  !exit - Exit the program');
console.log('  !server - Start the web server');
console.log('  !langchain <request> - Use LangChain agent for the request');
console.log('===============================================');

function askForInput() {
  rl.question('> ', async (input) => {
    if (input.trim() === '!exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }

    if (input.trim() === '!server') {
      console.log('Starting server...');
      rl.close();
      require('./server');
      return;
    }

    let useLangChain = false;
    let userInput = input;

    if (input.startsWith('!langchain ')) {
      useLangChain = true;
      userInput = input.substring('!langchain '.length);
    }

    try {
      console.log(`Processing request${useLangChain ? ' with LangChain agent' : ''}...`);
      
      const startTime = Date.now();
      const result = useLangChain 
        ? await mondayAgent.processRequestWithLangChain(userInput)
        : await mondayAgent.processRequest(userInput);
      const endTime = Date.now();
      
      console.log('\nResult:');
      console.log('-'.repeat(50));
      console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
      console.log(`Message: ${result.message}`);
      
      if (result.details && result.details.length > 0) {
        console.log('\nCreated Resources:');
        result.details.forEach(detail => {
          console.log(`- ${detail.type}: ${detail.name || detail.title || 'Unnamed'} (ID: ${detail.id})`);
        });
      }
      
      console.log('-'.repeat(50));
      console.log(`Time taken: ${(endTime - startTime) / 1000} seconds\n`);
    } catch (error) {
      console.error('Error:', error.message);
    }

    askForInput();
  });
}

askForInput();
