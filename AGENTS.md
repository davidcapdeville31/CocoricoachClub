# Architecture decisions

- Athlete staff badges use unread `session_feedback` (RPE) and `wellness_submitted` (wellness) notifications as their source of truth, so read state stays user-specific without duplicating submission data.