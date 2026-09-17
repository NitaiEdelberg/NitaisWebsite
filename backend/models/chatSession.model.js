import mongoose from "mongoose";

// One conversation per user, kept as a single document.
//
// Why one document rather than a messages collection: this is a recommendation
// chat, not a messaging product. The whole useful state — the last few turns, a
// summary of what came before, and what we have learned about someone's taste —
// is a few kilobytes, it is always read and written together, and one document
// means one round trip. A collection of messages would be the right shape if we
// ever needed to page through history; we never do, because the LLM is only
// ever shown a bounded slice of it.
//
// What is NOT stored: anything identifying beyond the user reference. No names,
// no emails, no free-text about the person. The messages are about films.

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true, maxlength: 2000 },
    // Titles this assistant turn offered, so a later turn can say "not those".
    titles: { type: [String], default: [] },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

// A preference we are confident about because the person said it, or one we
// guessed from behaviour. They are stored in the same shape but never treated
// the same: an explicit dislike is a rule, an inferred one is a hint, and only
// explicit preferences survive a contradiction.
const preferenceSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["genre", "tone", "era", "language", "theme", "avoid"],
      required: true,
    },
    value: { type: String, required: true, maxlength: 60 },
    // "likes" or "dislikes" — a preference without a direction is not one.
    sentiment: { type: String, enum: ["likes", "dislikes"], required: true },
    source: { type: String, enum: ["explicit", "inferred"], required: true },
    // How many turns supported it. An inference seen once is a guess; one seen
    // four times is close to something the person would say out loud.
    weight: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    // Recent turns only. Older ones are folded into `summary` — see
    // services/recommendation/conversation.js.
    messages: { type: [messageSchema], default: [] },
    summary: { type: String, default: "", maxlength: 1500 },
    preferences: { type: [preferenceSchema], default: [] },
    // Titles already offered, so the same five films do not come back.
    shown: { type: [String], default: [] },
    // Titles explicitly turned down. Stronger than "shown": never offer again.
    rejected: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.ChatSession ||
  mongoose.model("ChatSession", chatSessionSchema);
