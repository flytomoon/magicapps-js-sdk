export { MagicAppsClient } from "./client.js";
export type {
  MagicAppsConfig,
  AppInfo,
  Template,
  ApiResponse,
  PaginatedResponse,
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChoice,
  TokenUsage,
  ChatCompletionResponse,
  EmbeddingData,
  EmbeddingResponse,
  GeneratedImage,
  ImageGenerationResponse,
  ModerationCategories,
  ModerationCategoryScores,
  ModerationResult,
  ModerationResponse,
  Device,
  DeviceCatalogResponse,
  RegistryApp,
  AuthTokenResponse,
} from "./types.js";
export { MagicAppsError, ApiError } from "./errors.js";
export {
  deprecated,
  warnDeprecated,
  type DeprecationOptions,
} from "./deprecation.js";
export {
  generateHmacSignature,
  verifyHmacSignature,
  type HmacSignatureHeaders,
} from "./hmac.js";
