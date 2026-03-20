# @magic-apps-cloud/sdk

Official TypeScript/JavaScript SDK for the Magic Apps Cloud platform.

## Installation

```bash
npm install @magic-apps-cloud/sdk
```

## Quick Start

```typescript
import { MagicAppsClient } from "@magic-apps-cloud/sdk";

const client = new MagicAppsClient({
  baseUrl: "https://api.yourplatform.com",
  appId: "your-app-id",
});

// Get app info
const { data: app } = await client.getAppInfo();
console.log(app.name);

// List templates
const { data: templates } = await client.listTemplates();
```

## Authentication

Pass an auth token for authenticated endpoints:

```typescript
const client = new MagicAppsClient({
  baseUrl: "https://api.yourplatform.com",
  appId: "your-app-id",
  authToken: "your-jwt-token",
});

// Or update it later
client.setAuthToken("new-token");
```

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | `string` | Yes | - | Base URL of the Magic Apps Cloud API |
| `appId` | `string` | Yes | - | Your registered application ID |
| `authToken` | `string` | No | - | JWT token for authenticated requests |
| `timeout` | `number` | No | `30000` | Request timeout in milliseconds |

## Error Handling

```typescript
import { MagicAppsClient, ApiError, MagicAppsError } from "@magic-apps-cloud/sdk";

try {
  await client.getAppInfo();
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API error ${error.statusCode}: ${error.message}`);
  } else if (error instanceof MagicAppsError) {
    console.error(`SDK error: ${error.message}`);
  }
}
```

## License

MIT
