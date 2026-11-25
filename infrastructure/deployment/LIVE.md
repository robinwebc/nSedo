# Live on nSedo

Live video is WebRTC, one host to a few viewers. The API only forwards signaling over the existing Socket.IO connection. Media does not go through Render.

## Limits

- Up to 5 viewers, not counting the host. The host encodes a separate copy of the stream for each viewer, so a phone cannot carry a large audience.
- Viewers who cannot open a direct path need a TURN server. Set `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`. STUN `stun:stun.l.google.com:19302` is always used.
- Render’s free instance sleeps when idle and can drop a quiet socket. Start the API (any HTTP request) before going live, and expect the room to end if the process restarts.
- Live chat is text only and is stored as `LiveComment` rows.

## Flow

1. The host calls `POST /live` and emits `live:join`.
2. A viewer emits `live:join`. The server tells the host `live:viewer-joined`.
3. The host sends an SDP offer with `live:signal`. The viewer answers the same way, including ICE candidates.
4. Comments use `live:comment` and are broadcast to the room. `live:viewers` carries the current count.
5. The host emits `live:end` or calls `POST /live/:id/end`.
