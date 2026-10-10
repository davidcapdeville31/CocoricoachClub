export interface SessionAuthorship {
  session_id: string;
  author_user_id: string | null;
  author_name: string | null;
  author_player_id?: string | null;
}

export function isOwnSession(author: SessionAuthorship, viewerUserId?: string, viewerPlayerId?: string) {
  if (author.author_user_id) return author.author_user_id === viewerUserId;
  return !!viewerPlayerId && !!author.author_player_id && author.author_player_id === viewerPlayerId;
}