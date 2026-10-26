export interface MattermostSession {
  baseUrl: string;
  token: string;
  csrfToken: string;
  userId: string;
  lang: string;
}

export interface PostOptions {
  page?: string | number;
  perPage?: string | number;
  before?: string;
  after?: string;
}

export interface WebSocketMessage {
  event?: string;
  data?: Record<string, unknown>;
  broadcast?: {
    channel_id?: string;
    user_id?: string;
    team_id?: string;
  };
  seq?: number;
  status?: string;
  seq_reply?: number;
}
