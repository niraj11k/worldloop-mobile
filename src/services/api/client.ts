/**
 * Game API client.
 * Endpoints per PRD section 20:
 *   POST /api/v1/games
 *   POST /api/v1/games/{game_id}/moves
 *   POST /api/v1/games/{game_id}/hint
 *   GET  /api/v1/games/{game_id}
 *   POST /api/v1/games/{game_id}/end
 *
 * Account endpoints are an open item (Architecture doc section 9) and are
 * not yet defined here.
 *
 * Base URL and auth header wiring are not yet configured — no backend
 * environment has been decided (Architecture doc section 1).
 */

const API_BASE_URL = process.env.WORDLOOP_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'WORDLOOP_API_BASE_URL is not configured. Backend environment has not been set up yet.',
    );
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

export interface StartGameRequest {
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  playerMode: 'guest' | 'account';
}

export interface StartGameResponse {
  gameId: string;
  difficulty: string;
  currentWord: string;
  requiredLetter: string;
  status: string;
}

export function startGame(payload: StartGameRequest): Promise<StartGameResponse> {
  return request<StartGameResponse>('/api/v1/games', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface SubmitMoveRequest {
  word: string;
}

export interface SubmitMoveResponse {
  valid: boolean;
  playerWord: string;
  computerWord: string | null;
  requiredLetter: string | null;
  status: string;
}

export function submitMove(gameId: string, payload: SubmitMoveRequest): Promise<SubmitMoveResponse> {
  return request<SubmitMoveResponse>(`/api/v1/games/${gameId}/moves`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
