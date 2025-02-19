# Serper Google Search MCP Server

[![smithery badge](https://smithery.ai/badge/@NightTrek/Serper-search-mcp)](https://smithery.ai/server/@NightTrek/Serper-search-mcp)
![serper-logo](https://github.com/user-attachments/assets/d635efd2-f044-4e42-a938-45e44de7d12b)

A Model Context Protocol server that provides Google search capabilities through the Serper API. This server enables easy integration of Google search functionality into your MCP-enabled applications.


## ✨ Features

- 🌐 Powerful Google 
search integration through Serper API
- 🔄 Rich response data including:
  - Knowledge Graph information
  - Organic search results
  - "People Also Ask" questions
  - Related searches
- 🛠 Configurable search parameters:
  - Country targeting
  - Language selection
  - Result count customization
  - Autocorrect options
- 🔒 Secure API key handling
- ⚡️ Rate limiting and caching support
- 📝 TypeScript support with full type definitions

## 🚀 Installation

### Installing via Smithery

To install Serper Google Search Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@NightTrek/Serper-search-mcp):

```bash
npx -y @smithery/cli install @NightTrek/Serper-search-mcp --client claude
```

### Manual Installation
1. Clone the repository:
```bash
git clone https://github.com/yourusername/serper-search-server.git
cd serper-search-server
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the server:
```bash
pnpm run build
```

## ⚙️ Configuration

1. Get your Serper API key from [Serper.dev](https://serper.dev)

2. Create a `.env` file in the root directory:
```env
SERPER_API_KEY=your_api_key_here
```

## 🔌 Integration

### Claude Desktop

Add the server config to your Claude Desktop configuration:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "serper-search-server": {
      "command": "/path/to/serper-search-server/build/index.js",
      "env": {
        "SERPER_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## 🛠 Usage

The server provides a powerful search tool with the following parameters:

```typescript
{
  "query": string,          // Search query
  "numResults"?: number,    // Number of results (default: 10, max: 100)
  "gl"?: string,           // Country code (e.g., "us", "uk")
  "hl"?: string,           // Language code (e.g., "en", "es")
  "autocorrect"?: boolean, // Enable autocorrect (default: true)
  "type"?: "search"        // Search type (more types coming soon)
}
```

### Example Response

The search results include rich data:

```json
{
  "searchParameters": {
    "q": "apple inc",
    "gl": "us",
    "hl": "en",
    "autocorrect": true,
    "type": "search"
  },
  "knowledgeGraph": {
    "title": "Apple",
    "type": "Technology company",
    "website": "http://www.apple.com/",
    "description": "Apple Inc. is an American multinational technology company...",
    "attributes": {
      "Headquarters": "Cupertino, CA",
      "CEO": "Tim Cook (Aug 24, 2011–)",
      "Founded": "April 1, 1976, Los Altos, CA"
    }
  },
  "organic": [
    {
      "title": "Apple",
      "link": "https://www.apple.com/",
      "snippet": "Discover the innovative world of Apple...",
      "position": 1
    }
  ],
  "peopleAlsoAsk": [
    {
      "question": "What does Apple Inc mean?",
      "snippet": "Apple Inc., formerly Apple Computer, Inc....",
      "link": "https://www.britannica.com/topic/Apple-Inc"
    }
  ],
  "relatedSearches": [
    {
      "query": "Who invented the iPhone"
    }
  ]
}
```

## 🔍 Response Types

### Knowledge Graph
Contains entity information when available:
- Title and type
- Website URL
- Description
- Key attributes

### Organic Results
List of search results including:
- Title and URL
- Snippet (description)
- Position in results
- Sitelinks when available

### People Also Ask
Common questions related to the search:
- Question text
- Answer snippet
- Source link

### Related Searches
List of related search queries users often make.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Serper API](https://serper.dev) for providing the Google search capabilities
- [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) for the MCP framework
