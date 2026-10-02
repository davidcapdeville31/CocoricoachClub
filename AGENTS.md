# Architecture decisions

- Athlete RPE staff badges use unread `session_feedback` notifications as their source of truth, so read state stays user-specific without duplicating submission data.