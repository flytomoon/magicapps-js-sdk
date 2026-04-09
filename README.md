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

The SDK supports two authentication contexts depending on your platform:

**Web apps** — Users authenticate via Cognito (Apple Sign-In, Google, passkeys, magic links) and receive an access token. Pass it as `accessToken`:

```typescript
const client = new MagicAppsClient({
  baseUrl: "https://api.yourplatform.com",
  appId: "your-app-id",
  accessToken: "cognito-jwt-token",
});
```

**Mobile apps (iOS/Android)** — Devices register anonymously via `registerOwner()` and receive an owner token. After account creation, users also get an access token. Pass both:

```typescript
const client = new MagicAppsClient({
  baseUrl: "https://api.yourplatform.com",
  appId: "your-app-id",
  ownerToken: "owner-jwt-from-registration",
  accessToken: "cognito-jwt-after-login",  // optional, set after account creation
});
```

All SDK methods use the appropriate token automatically. On web, all methods work with just `accessToken`. On mobile, methods that predate account creation (endpoints, email, lookups) use `ownerToken`, while payment and entitlement methods use `accessToken`.

```typescript
// Update tokens after login or refresh
client.setTokens({ accessToken: "new-access-token" });

// Or update just the access token (legacy alias)
client.setAuthToken("new-token");

// Clear all tokens (e.g. on logout)
client.clearTokens();
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

// Post an event to an endpoint (unsigned)
const { data: event } = await client.postEvent(endpoint.slug, {
  message: "Hello from the SDK",
});

// Post a signed event (HMAC-SHA256 — use the secret from endpoint creation)
const { data: signed } = await client.postEvent(
  endpoint.slug,
  { message: "Signed payload" },
  endpoint.hmac_secret,
);

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

The simplest way to sign events is by passing `hmacSecret` directly to `postEvent()` (see above). For advanced use cases — such as verifying incoming webhooks or signing requests outside the SDK — standalone helper functions are also available. The signature format is `HMAC-SHA256(secret, "slug:timestamp:body")`.

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

## Email

Create tokenized email content (images and text) and deliver it to recipients via the platform's email service. Requires the Growth plan.

```typescript
// Create an image token (returns a hosted URL that shows a placeholder until content is uploaded)
const { data: imageToken } = await client.email.createImageToken();
console.log(imageToken.token);      // "img_abc123"
console.log(imageToken.image_url);  // "https://img.assethost.net/r/i/img_abc123.jpg"

// Upload the actual image content (JPEG, base64-encoded)
await client.email.uploadImage(imageToken.token, jpegBase64String);

// Create a text token (same pattern — placeholder until text is uploaded)
const { data: textToken } = await client.email.createTextToken();

// Upload text content (rendered as a styled SVG image)
await client.email.uploadText(textToken.token, { sentence: "Your prediction was correct!" });

// Check token status
const { data: status } = await client.email.getImageTokenStatus(imageToken.token);
console.log(status.state);  // "armed" | "ready" | "consumed"
```

### Sending Email

Deliver tokenized content to a recipient via the platform's email service. The email contains the hosted image/text inline — no attachments, no links to click.

```typescript
// Send an email with an image token
const { data: result } = await client.email.send({
  to: "recipient@example.com",
  token: imageToken.token,
  subject: "Game result",
  senderName: "Chris C.",  // optional — appears as "Chris C. via Your App"
});
console.log(result.message_id);  // SES message ID
console.log(result.status);      // "sent"
```

The email arrives as:
```
From: "Chris C. via Your App" <noreply@send.assethost.net>
Subject: Game result
Body: [inline image from the token]
```

- `senderName` is optional — if omitted, the From shows just the app name
- Rate limited: 10 emails/hour, 50 emails/day per user
- Recipients can unsubscribe via a link in the email footer
- Works with both image and text tokens (both render as inline images)

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

## User Profiles

```typescript
// Get the current user's profile
const { data: profile } = await client.getProfile();
console.log(profile.display_name);

// Update the current user's profile
const { data: updated } = await client.updateProfile({
  display_name: "Jane Doe",
  bio: "Mobile developer",
  preferences: { theme: "dark" },
  custom_fields: { company: "Acme" },
});

// Get another user's public profile
const { data: publicProfile } = await client.getPublicProfile("user-id");
console.log(publicProfile.display_name);
```

## Account Management

```typescript
// Delete the current user's account (optional reason)
await client.deleteAccount("No longer using the app");

// Delete without a reason
await client.deleteAccount();

// Export account data
const { data: exportData } = await client.exportAccountData();
console.log(exportData.exported_at);

// Get consent preferences
const { data: consent } = await client.getConsent();
console.log(consent.analytics);

// Update consent preferences
await client.updateConsent({
  analytics: true,
  marketing: false,
  third_party: false,
});
```

## File Storage

```typescript
// Get a pre-signed upload URL
const { data: upload } = await client.getFileUploadUrl("photo.jpg", "image/jpeg");
console.log(upload.upload_url);
console.log(upload.file_id);

// Upload the file using the pre-signed URL
await fetch(upload.upload_url, {
  method: "PUT",
  body: fileData,
  headers: { "Content-Type": "image/jpeg" },
});

// List all files
const { data: fileList } = await client.listFiles();
for (const file of fileList.files) {
  console.log(`${file.filename}: ${file.content_type}`);
}

// Get a specific file
const { data: file } = await client.getFile("file-id");

// Delete a file
await client.deleteFile("file-id");
```

## AI Conversations

Manage persistent AI conversations with message history.

```typescript
// Create a new conversation
const { data: conversation } = await client.createConversation({
  title: "Help me debug",
  model: "gpt-4",
  system_prompt: "You are a helpful coding assistant.",
});
console.log(conversation.conversation_id);

// List conversations (with optional pagination)
const { data: list } = await client.listConversations();
for (const conv of list.conversations) {
  console.log(`${conv.title} (${conv.message_count} messages)`);
}

// Paginate through conversations
const { data: page2 } = await client.listConversations(list.next_token);

// Get a specific conversation
const { data: conv } = await client.getConversation("conversation-id");

// Send a message and get a response
const { data: response } = await client.sendMessage(
  "conversation-id",
  "How do I fix a memory leak?",
  { temperature: 0.7 },
);
console.log(response.message.content);

// Delete a conversation
await client.deleteConversation("conversation-id");
```

## Push Notifications

```typescript
// Register a device for push notifications
const { data: registration } = await client.registerDevice(
  "push-token-from-os",
  "ios",
  "optional-device-id",
);
console.log(registration.device_id);

// Unregister a device
await client.unregisterDevice("device-id");
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
| `accessToken` | `string` | No | - | Cognito JWT for authenticated user requests (web and mobile) |
| `ownerToken` | `string` | No | - | Owner JWT from device registration (mobile only) |
| `authToken` | `string` | No | - | **Deprecated.** Alias for `accessToken` |
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
