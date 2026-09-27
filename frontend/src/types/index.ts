export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id?: string;
  conversation_id?: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  model?: string;
  token_usage?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms?: number;
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
  system_prompt: string;
  temperature: number;
  memory_enabled: boolean;
}

export interface ModelCatalogItem {
  id: string;
  name: string;
  provider: string;
  description: string;
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
