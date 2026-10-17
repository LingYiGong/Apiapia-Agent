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

export interface GeneratedVideo {
  id?: string;
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
  generated_videos?: string | null;
  tool_invocations?: ToolInvocation[] | string | null;
  search_query?: string | null;
  /** 'stop' = complete, 'abort' = user stopped, 'error' = failed, 'length' = token truncated, 'content_filter' = blocked */
  finish_reason?: "stop" | "abort" | "error" | "length" | "content_filter" | (string & {}) | null;
  toolInvocations?: ToolInvocation[];
  generatedImages?: GeneratedImage[];
  generatedVideos?: GeneratedVideo[];
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

export interface ConsolidationPlanItem {
  id?: string;
  text: string;
  old_text?: string;
  category?: string;
  importance?: number;
  reason?: string;
}

export interface ConsolidationPlan {
  to_delete: ConsolidationPlanItem[];
  to_update: ConsolidationPlanItem[];
  to_add: ConsolidationPlanItem[];
  to_keep: ConsolidationPlanItem[];
}

export interface ConsolidationPreviewResponse {
  status: string;
  message?: string;
  total_count?: number;
  summary?: string;
  plan?: ConsolidationPlan;
}

export interface ConsolidationSnapshotStatus {
  has_snapshot: boolean;
  snapshot_time?: string | null;
  count: number;
}


export interface UserSetting {
  id: string;
  user_id: string;
  default_model: string;
  memory_model?: string;
  consolidation_model?: string;
  image_model?: string | null;
  video_model?: string | null;
  /** 语音识别与语音合成分开两个字段：上游是两族互不相交的模型 */
  stt_model?: string | null;
  tts_model?: string | null;
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

export interface VideoModelItem {
  id: string;
  name: string;
  provider: string;
  description?: string;
  is_free: boolean;
}

export interface VideoModelsResponse {
  total: number;
  models: VideoModelItem[];
  can_access_all_models: boolean;
  synced: boolean;
}

/** 语音模型目录项 */
export interface AudioModelItem {
  id: string;
  name: string;
  provider: string;
  description?: string;
  is_free: boolean;
  capability: "stt" | "tts";
  /** 该合成模型支持的音色；识别模型为 null */
  supported_voices?: string[] | null;
}

export interface AudioModelsResponse {
  total: number;
  models: AudioModelItem[];
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
