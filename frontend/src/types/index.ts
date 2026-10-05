export interface User {
  id: string;
  username: string;
  email: string;
  is_superuser?: boolean;
  is_active?: boolean;
  can_access_all_models?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  username?: string;
  title: string;
  model: string;
  is_deleted?: boolean;
  deleted_at?: string;
  is_pinned?: boolean;
  pin_order?: number;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  size: number;
  type: "image" | "document";
  mime_type: string;
  data_url: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: any;
  state: "call" | "result";
  result?: any;
}

export interface GeneratedImage {
  id?: string;
  // Only populated for the very first render of a freshly streamed image; the
  // durable reference is `id`, resolved through /api/media/images/{id}.
  url?: string;
  prompt: string;
  provider: string;
  model: string;
  ext?: string;
  bytes?: number;
}

export interface Message {
  id?: string;
  conversation_id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  attachments?: AttachmentItem[];
  search_results?: SearchResultItem[] | string;
  generated_images?: string | null;
  tool_invocations?: ToolInvocation[] | string | null;
  search_query?: string | null;
  /** 'stop' = complete, 'abort' = user stopped it, 'error' = provider failed */
  finish_reason?: "stop" | "abort" | "error" | null;
  toolInvocations?: ToolInvocation[];
  generatedImages?: GeneratedImage[];
  model?: string;
  token_usage?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms?: number;
  thinking_duration_ms?: number;
  created_at?: string;
}

export interface MemoryItem {
  id: string;
  memory: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface UserSetting {
  id: string;
  user_id: string;
  default_model: string;
  memory_model?: string;
  image_model?: string | null;
  system_prompt: string;
  temperature: number;
  memory_enabled: boolean;
  web_search_mode?: "auto" | "on" | "off";
}

export interface ImageModelItem {
  id: string;
  name: string;
  provider: string;
  description?: string;
  is_free: boolean;
}

export interface ImageModelsResponse {
  total: number;
  models: ImageModelItem[];
  can_access_all_models: boolean;
  synced: boolean;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  provider: string;
  description: string;
  is_free?: boolean;
  is_multimodal?: boolean;
}

export interface ModelConfig {
  id: string;
  user_id: string;
  provider: string;
  model: string;
  has_api_key: boolean;
  base_url?: string;
  enabled: boolean;
  created_at: string;
}

export interface ModelUsageItem {
  model: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_cny: number;
  is_free: boolean;
}

export interface DailyUsageItem {
  date: string;
  calls: number;
  tokens: number;
  cost_usd: number;
  cost_cny: number;
}

export interface MyUsageStats {
  period?: string;
  user_id: string;
  username: string;
  is_superuser: boolean;
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  estimated_cost_cny: number;
  model_breakdown: ModelUsageItem[];
  daily_trend: DailyUsageItem[];
}

export interface AdminUserUsageItem {
  user_id: string;
  username: string;
  email: string;
  is_superuser: boolean;
  is_active: boolean;
  can_access_all_models?: boolean;
  created_at: string;
  conversations_count: number;
  messages_count: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  estimated_cost_cny: number;
  top_model: string;
}

export interface AdminOverviewStats {
  period?: string;
  total_users: number;
  active_users: number;
  total_conversations: number;
  total_messages: number;
  total_tokens: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_cost_usd: number;
  total_cost_cny: number;
  users: AdminUserUsageItem[];
  model_breakdown: ModelUsageItem[];
  daily_trend: DailyUsageItem[];
}
