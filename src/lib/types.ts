export interface TopicBatch {
  id: string;
  created_at: string;
  generated_date: string;
  source_type: 'daily_cron' | 'youtube' | 'manual';
  youtube_url: string | null;
  performance_context: string | null;
}

export interface Topic {
  id: string;
  batch_id: string;
  created_at: string;
  position: number;
  title: string;
  category: string;
  hook_line: string;
  core_insight: string;
  talking_points: string[];
  cta: string;
  source_url: string | null;
  status: 'pending' | 'script_requested' | 'script_ready' | 'approved' | 'shot' | 'discarded';
}

export interface Script {
  id: string;
  topic_id: string;
  created_at: string;
  content: string;
  status: 'pending_review' | 'approved' | 'shot';
}

export interface Performance {
  id: string;
  topic_id: string;
  script_id: string | null;
  logged_at: string;
  views: number | null;
  likes: number | null;
  shares: number | null;
  saves: number | null;
  comments: number | null;
  hook_rate: number | null;
  notes: string | null;
}

// Joined types for UI
export interface TopicWithScript extends Topic {
  scripts?: Script[];
}

export interface ScriptWithTopic extends Script {
  topics?: Topic;
}

export interface PerformanceWithDetails extends Performance {
  topics?: Topic;
  scripts?: Script;
}
