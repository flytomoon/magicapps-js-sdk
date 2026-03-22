# @magic-apps-cloud/sdk

Official TypeScript/JavaScript SDK for the Magic Apps Cloud platform. Provides tenant-scoped API access with authentication, AI services, device catalogs, templates, endpoints, lookup tables, and more.

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

// Health check
const { data: pong } = await client.ping();
console.log(pong.message);

// Get app info
const { data: app } = await client.getAppInfo();
console.log(app.name);

// Get a template
const { data: template } = await client.getTemplate("template-id");

// Get the app catalog
const { data: catalog } = await client.getCatalog();
```

## Authentication

Pass an auth token for authenticated endpoints:

```typescript
const client = new MagicAppsClient({
  baseUrl: "https://api.yourplatform.com",
  appId: "your-app-id",
  authToken: "your-jwt-token",
});

// Update the token later (e.g. after login or refresh)
client.setAuthToken("new-token");

// Clear the token (e.g. on logout)
client.clearAuthToken();
```

### Apple Sign-In

```typescript
const { data: tokens } = await client.appleExchangeToken(
  identityToken,
  "your-app-id"
);
client.setAuthToken(tokens.token);
```

### Google Sign-In

```typescript
const { data: tokens } = await client.googleExchangeToken(
  googleIdToken,
  "your-app-id"
);
client.setAuthToken(tokens.token);
```

### Passkeys (WebAuthn)

```typescript
// Registration flow
const { data: options } = await client.getPasskeyRegisterOptions();
// ... use options.challenge with the Web Authentication API ...
const { data: result } = await client.verifyPasskeyRegistration(credential);

// Authentication flow
const { data: authOptions } = await client.getPasskeyAuthOptions();
// ... use authOptions.challenge with the Web Authentication API ...
const { data: authResult } = await client.verifyPasskeyAuth(assertion);
```

### Email Magic Link

```typescript
// Request a magic link
await client.requestEmailMagicLink("user@example.com");

// Verify the token from the link
const { data: tokens } = await client.verifyEmailMagicLink(token);
client.setAuthToken(tokens.token);
```

### Token Refresh

```typescript
const { data: tokens } = await client.refreshToken(refreshToken);
client.setAuthToken(tokens.token);
```

### Identity Linking

```typescript
// Link an external provider to the current account
await client.linkProvider("google", providerToken);
```

## Owner Registration

Register device owners for anonymous app usage and migrate them to full accounts:

```typescript
// Register a device owner (returns an owner token)
const { data: owner } = await client.registerOwner(
  "device-uuid",
  "your-app-id"
);

// Migrate owner data to a signed-in user
await client.migrateOwnerToUser("device-uuid", "your-app-id");
```

## AI Services

The SDK provides access to chat completions, embeddings, image generation, and content moderation via the platform's AI proxy. Requests are routed through the tenant's configured provider (OpenAI, Anthropic, Google).

### Chat Completions

```typescript
import type { ChatMessage, ChatCompletionRequest } from "@magic-apps-cloud/sdk";

// Convenience: pass a messages array
const messages: ChatMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Explain serverless architecture." },
];
const { data: chatResult } = await client.chat(messages, { model: "gpt-4" });
console.log(chatResult.choices[0].message.content);

// Full chat completion request
const request: ChatCompletionRequest = {
  messages,
  model: "gpt-4",
  temperature: 0.7,
  max_tokens: 500,
};
const { data: completion } = await client.createChatCompletion(request);
```

### Embeddings

```typescript
// Convenience method
const { data: embeddings } = await client.embed("Hello world");
console.log(embeddings.data[0].embedding);

// With model parameter
const { data: embeddingResult } = await client.createEmbedding(
  "Some text to embed",
  "text-embedding-ada-002"
);
```

### Image Generation

```typescript
// Convenience method
const { data: image } = await client.generateImage("A sunset over mountains");
console.log(image.data[0].url);

// With options
const { data: images } = await client.createImage("A forest landscape", {
  n: 2,
  size: "1024x1024",
});
```

### Content Moderation

```typescript
// Convenience method
const { data: moderation } = await client.moderate("Some user content");
if (moderation.results[0].flagged) {
  console.log("Content flagged!");
}

// With model parameter
const { data: result } = await client.createModeration("Text to check", "text-moderation-stable");
```

## Templates and Catalog

```typescript
// Get a specific template by ID
const { data: template } = await client.getTemplate("template-id");
console.log(template.name);

// Get the full app catalog
const { data: catalog } = await client.getCatalog();
```

## Devices

```typescript
// Fetch the device catalog
const { data: catalog } = await client.getDevices();
console.log(catalog.devices.length);

// Convenience: get a flat list of all devices
const devices = await client.getAllDevices();
for (const device of devices) {
  console.log(`${device.device_name}: ${device.device_type}`);
}
```

## Endpoints and Events

Webhook endpoint management and event delivery with optional HMAC signing.

```typescript
// Create a new webhook endpoint
const { data: endpoint } = await client.createEndpoint();
console.log(`Slug: ${endpoint.slug}`);
console.log(`Path: ${endpoint.endpoint_path}`);

// Post an event to an endpoint
const { data: event } = await client.postEvent(endpoint.slug, {
  message: "Hello from the SDK",
});

// Consume an event (single-slot, consume-on-read)
const { data: consumed } = await client.consumeEvent(endpoint.slug);

// Revoke and replace an endpoint
const { data: replacement } = await client.revokeAndReplaceEndpoint(
  endpoint.slug
);
console.log(`New slug: ${replacement.new_slug}`);

// Revoke an endpoint without replacement
await client.revokeEndpoint(endpoint.slug);
```

### HMAC Signing

The SDK provides standalone functions for generating and verifying HMAC signatures on endpoint events. The signature format is `HMAC-SHA256(secret, "slug:timestamp:body")`.

```typescript
import { generateHmacSignature, verifyHmacSignature } from "@magic-apps-cloud/sdk";

// Generate signature headers for posting a signed event
const headers = await generateHmacSignature(
  "my-endpoint-slug",
  JSON.stringify({ data: "payload" }),
  "hmac-secret-from-endpoint"
);
// Use headers.signature and headers.timestamp in your request

// Verify an incoming webhook signature (constant-time comparison, clock skew check)
const isValid = await verifyHmacSignature(
  "my-endpoint-slug",
  rawBody,
  request.headers["x-signature"],
  request.headers["x-timestamp"],
  "hmac-secret-from-endpoint",
  300 // maxSkewSeconds (default)
);
```

## Lookup Tables

Read-only access to lookup tables (reference data configured by tenant admins).

```typescript
// List available lookup tables
const { data: tables } = await client.listLookupTables();

// Get a specific table's metadata (includes chunk refs)
const { data: detail } = await client.getLookupTable("table-id");

// Fetch an individual data chunk by index
const { data: chunk } = await client.getLookupTableChunk("table-id", 0);

// Fetch with a specific version for cache consistency
const { data: versionedChunk } = await client.getLookupTableChunk(
  "table-id",
  0,
  5
);

// Fetch the complete dataset (all chunks merged)
const { data: fullData } = await client.getFullLookupTableDataset("table-id");
```

## Settings and Config

```typescript
// Get/update user settings
const { data: settings } = await client.getSettings();
await client.updateSettings({ theme: "dark", notifications: true });

// Get/update config
const { data: config } = await client.getConfig();
await client.updateConfig({ feature_flags: { beta: true } });

// Integration secrets
const { data: secret } = await client.getIntegrationSecret("integration-id");
await client.uploadIntegrationSecret("integration-id", {
  api_key: "sk-...",
});
```

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | `string` | Yes | - | Base URL of the Magic Apps Cloud API |
| `appId` | `string` | Yes | - | Your registered application ID |
| `authToken` | `string` | No | - | JWT token for authenticated requests |
| `timeout` | `number` | No | `30000` | Request timeout in milliseconds |

## Error Handling

The SDK provides typed error classes for structured error handling:

```typescript
import { MagicAppsClient, ApiError, MagicAppsError } from "@magic-apps-cloud/sdk";

try {
  const { data } = await client.getAppInfo();
} catch (error) {
  if (error instanceof ApiError) {
    // HTTP error from the API (4xx, 5xx)
    console.error(`API error ${error.statusCode}: ${error.message}`);
    console.error("Response body:", error.responseBody);
  } else if (error instanceof MagicAppsError) {
    // SDK-level error (timeout, network failure, missing config)
    console.error(`SDK error: ${error.message}`);
  }
}
```

## Requirements

- Node.js 18+
- Web Crypto API (available in Node.js 15+, all modern browsers, Deno, Bun, Cloudflare Workers)

## License

MIT
