/**
 * Broadcasts a message to a Supabase Realtime channel via the HTTP API.
 *
 * Unlike WebSocket-based channel.send(), this works in stateless API routes
 * without maintaining a persistent connection. The Realtime service forwards
 * the message to all WebSocket subscribers of the named channel.
 *
 * Channel naming convention used across the auction system:
 *   auction-tp:{loadId}:{companyId}  — per-transporter position updates
 *   auction-sh:{loadId}              — shipper bid-list / blind-count updates
 *
 * @param {string} channelName  Channel name (WITHOUT the "realtime:" prefix)
 * @param {string} event        Broadcast event name
 * @param {object} payload      Serialisable payload to broadcast
 */
export async function broadcastToChannel(channelName, event, payload) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:${channelName}`,
          event: "broadcast",
          payload: { type: "broadcast", event, payload },
        },
      ],
    }),
  });

  if (!res.ok) {
    // Non-fatal — optimistic broadcast is best-effort
    console.warn(`[broadcast] Failed to send to ${channelName} (${res.status})`);
  }
}

/**
 * Broadcasts to multiple channels concurrently (fire-and-forget).
 * Errors are swallowed so callers don't need to await.
 *
 * @param {Array<{channel: string, event: string, payload: object}>} messages
 */
export function broadcastAll(messages) {
  for (const { channel, event, payload } of messages) {
    broadcastToChannel(channel, event, payload).catch(() => {});
  }
}
