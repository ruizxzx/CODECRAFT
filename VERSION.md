# OFFSCRPT V73.0

## Master Control Restoration

Restores the high-authority Master Control Center on top of V72.2 integrity hardening.

Key additions:
- Master admin allowlist by Firebase UID and verified email
- Moderator promotion/revocation and granular permissions
- User moderation, restrictions, warnings, profile cleanup and preference reset
- Article publishing, unpublishing, feature/pin, archive, delete, full JSON edit and revision restore/duplicate controls
- Root/community post moderation controls
- Central reports workflow with cloud status updates
- Real comment moderation for article, root-post and community-post comments
- Firestore-backed emergency controls with Security Rules enforcement
- Realtime system configuration synchronization
- Platform aggregate analytics and cloud recommendation-source health
- Presence count health check without exposing reader identities
- Privileged audit logging
- Emergency admin lock that only bootstrap masters can clear

The release does not claim Firebase Authentication deletion of another user's account from the browser. The user-management delete action removes the Firestore profile; Auth-account deletion remains a trusted-server operation.
