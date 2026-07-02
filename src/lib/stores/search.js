import { writable } from "svelte/store";

// Flat array of all raw message objects { id, sender, color, text, imageUrl, ts }
// Written by messages/+page.svelte on each poll.
export const messagesCache = writable([]);

// Array of live email chain objects { _id, subject, staged, createdAt, messages, preview, ts, unread }
// Written by emails/+page.svelte on each poll.
export const emailsCache = writable([]);
