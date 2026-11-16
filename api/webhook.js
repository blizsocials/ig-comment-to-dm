// Blizsocials Instagram Comment-to-DM Automation
// One serverless function: verifies Meta's webhook, then for each new comment
// containing the trigger keyword, posts a public reply and sends a private DM.
// Runs on Vercel. No database, no dependencies.

const GRAPH = "https://graph.instagram.com/v21.0";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Verification failed");
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "comments") continue;
          const v = change.value || {};
          const commentId = v.id;
          const text = (v.text || "").toLowerCase();
          const fromId = v.from?.id;

          if (!commentId || fromId === process.env.IG_USER_ID) continue;

          const keywords = (process.env.KEYWORDS || "")
            .toLowerCase()
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
          const matched = keywords.length === 0 || keywords.some((k) => text.includes(k));
          if (!matched) continue;

          const tokenParam = `access_token=${process.env.IG_ACCESS_TOKEN}`;

          await fetch(`${GRAPH}/${commentId}/replies?message=${encodeURIComponent(process.env.COMMENT_REPLY_TEXT || "Just sent it to your DMs!")}&${tokenParam}`, { method: "POST" });

          await fetch(`${GRAPH}/${process.env.IG_USER_ID}/messages?${tokenParam}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { comment_id: commentId },
              message: { text: process.env.DM_TEXT || "Here is the link you asked for!" },
            }),
          });
        }
      }
    } catch (e) {
      console.error("Webhook processing error:", e);
    }
    return res.status(200).send("EVENT_RECEIVED");
  }

  return res.status(405).send("Method not allowed");
}
