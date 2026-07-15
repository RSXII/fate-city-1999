<script>
  import { base } from '$app/paths';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { dbGet } from '$lib/firebase-db.js';
  import { visibilityAwareInterval } from '$lib/utils.js';

  let posts = [];
  let loading = true;
  let pollInterval;

  // Local like state — purely cosmetic, not persisted
  let likedSet = new Set();

  function toggleLike(id) {
    const s = new Set(likedSet);
    if (s.has(id)) s.delete(id); else s.add(id);
    likedSet = s;
  }

  function relTime(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'Just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  }

  function initials(name) {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Stable decorative like count — seeded by string
  function seedLikes(id, base) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
    return (base ?? 0) + (Math.abs(h) % 80);
  }

  async function loadPosts() {
    try {
      const data = await dbGet('fatestagram', { orderBy: '$key', limitToLast: 50 });
      if (!data) { posts = []; loading = false; return; }
      posts = Object.keys(data)
        .map(k => { const p = data[k]; p._id = k; return p; })
        .filter(p => (p.imageUrl || p.caption) && p.staged !== false)
        .sort((a, b) => b.ts - a.ts);
    } catch { posts = []; }
    loading = false;
  }

  onMount(() => {
    if (!browser) return;
    loadPosts();
    pollInterval = visibilityAwareInterval(loadPosts, 20000);
  });

  onDestroy(() => {
    if (pollInterval) pollInterval();
  });
</script>

<svelte:head>
  <title>Fate City: 1999 — FateStaGram</title>
</svelte:head>

<wire-status-bar jail layout="flex"></wire-status-bar>

<!-- App header -->
<header class="fsg-header">
  <a class="fsg-back" href="{base}/home" aria-label="Back to home">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  </a>

  <div class="fsg-wordmark" aria-label="FateStaGram">
    <svg class="fsg-logo-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5"/>
      <circle cx="12" cy="12" r="4.2"/>
      <line x1="12" y1="9.2" x2="12" y2="14.8"/>
      <line x1="9.2" y1="12" x2="14.8" y2="12"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
    <span class="fsg-wordmark-text">FateStaGram</span>
  </div>

  <button class="fsg-header-btn" aria-label="Notifications">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  </button>
</header>

<!-- Feed -->
<div class="fsg-feed">

  {#if loading}
    <div class="fsg-loading">
      <div class="fsg-loading-ring"></div>
    </div>

  {:else if posts.length === 0}
    <div class="fsg-empty">
      <div class="fsg-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5"/>
          <circle cx="12" cy="12" r="4.2"/>
          <line x1="12" y1="9.2" x2="12" y2="14.8"/>
          <line x1="9.2" y1="12" x2="14.8" y2="12"/>
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
      </div>
      <p class="fsg-empty-title">Nothing posted yet.</p>
      <p class="fsg-empty-sub">The feed is quiet. Check back later.</p>
    </div>

  {:else}
    {#each posts as post (post._id)}
      {@const liked = likedSet.has(post._id)}
      {@const displayLikes = seedLikes(post._id, post.likes ?? 0) + (liked ? 1 : 0)}

      <article class="fsg-post">

        <!-- Post header -->
        <div class="fsg-post-header">
          <div class="fsg-avatar-wrap">
            {#if post.avatarUrl}
              <img class="fsg-avatar-img" src={post.avatarUrl} alt="" loading="lazy"
                on:error={e => e.currentTarget.style.display = 'none'} />
            {:else}
              <div class="fsg-avatar-fallback">{initials(post.username ?? 'FC')}</div>
            {/if}
          </div>
          <div class="fsg-post-meta">
            <span class="fsg-username">{post.username ?? 'unknown'}</span>
            {#if post.handle}<span class="fsg-meta-sub">{post.handle}</span>{/if}
            {#if post.location}<span class="fsg-meta-location">{post.location}</span>{/if}
          </div>
          <button class="fsg-more-btn" aria-label="More options">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true">
              <circle cx="5" cy="12" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="19" cy="12" r="1.5"/>
            </svg>
          </button>
        </div>

        <!-- Post image -->
        {#if post.imageUrl}
          <div class="fsg-image-wrap">
            <img class="fsg-post-img" src={post.imageUrl} alt={post.caption ?? ''} loading="lazy" />
          </div>
        {/if}

        <!-- Action bar -->
        <div class="fsg-actions">
          <div class="fsg-actions-left">
            <button
              class="fsg-action-btn fsg-like-btn"
              class:liked
              on:click={() => toggleLike(post._id)}
              aria-label={liked ? 'Unlike' : 'Like'}
              aria-pressed={liked}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            <button class="fsg-action-btn" aria-label="Comment">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button class="fsg-action-btn" aria-label="Share">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <button class="fsg-action-btn fsg-bookmark-btn" aria-label="Save">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        <!-- Likes count -->
        <div class="fsg-post-body">
          <div class="fsg-likes">{displayLikes.toLocaleString()} likes</div>

          <!-- Caption -->
          {#if post.caption}
            <p class="fsg-caption">
              <span class="fsg-caption-user">{post.username ?? 'unknown'}</span>
              {post.caption}
            </p>
          {/if}

          <!-- Hashtags -->
          {#if post.tags}
            <p class="fsg-tags">{post.tags}</p>
          {/if}

          <!-- Decorative comment prompt -->
          <button class="fsg-view-comments" aria-label="View comments">
            View all {post.commentCount ?? Math.floor(seedLikes(post._id + 'c', 2) / 5)} comments
          </button>

          <!-- Top comment -->
          {#if post.topComment?.username && post.topComment?.text}
            <div class="fsg-top-comment">
              <span class="fsg-top-comment-user">{post.topComment.username}</span>
              <span class="fsg-top-comment-text">{post.topComment.text}</span>
              <span class="fsg-top-comment-likes">
                <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {(post.topComment.likes ?? 0).toLocaleString()}
              </span>
            </div>
          {/if}

          <!-- Timestamp -->
          <time class="fsg-timestamp" datetime={new Date(post.ts).toISOString()}>
            {relTime(post.ts)}
          </time>
        </div>

      </article>
    {/each}

    <!-- Bottom spacer for home bar -->
    <div class="fsg-bottom-spacer" aria-hidden="true"></div>
  {/if}
</div>

<style>
  /* ── Layout ── */
  .fsg-feed {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    background: #0d1118;
  }

  /* ── Header ── */
  .fsg-header {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 10px;
    height: 52px;
    background: #0d1118;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .fsg-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    color: #e8dfc8;
    text-decoration: none;
    flex-shrink: 0;
  }

  .fsg-wordmark {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }

  .fsg-logo-icon {
    width: 22px;
    height: 22px;
    stroke: url(#fsg-grad);
    flex-shrink: 0;
  }

  .fsg-wordmark-text {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.5px;
    background: linear-gradient(90deg, #c9a227 0%, #e05a3a 55%, #b83299 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-family: Georgia, 'Times New Roman', serif;
    font-style: italic;
  }

  .fsg-header-btn {
    width: 38px;
    height: 38px;
    background: none;
    border: none;
    color: #e8dfc8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
  }

  /* ── Loading ── */
  .fsg-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
  }
  .fsg-loading-ring {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(201,162,39,0.2);
    border-top-color: #c9a227;
    animation: fsg-spin 0.8s linear infinite;
  }
  @keyframes fsg-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Empty state ── */
  .fsg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 32px;
    gap: 10px;
  }
  .fsg-empty-icon {
    width: 64px;
    height: 64px;
    opacity: 0.25;
    color: #c9a227;
  }
  .fsg-empty-icon svg {
    width: 100%;
    height: 100%;
    stroke: currentColor;
  }
  .fsg-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #e8dfc8;
    margin: 0;
  }
  .fsg-empty-sub {
    font-size: 12px;
    color: rgba(232,223,200,0.35);
    margin: 0;
    text-align: center;
  }

  /* ── Post ── */
  .fsg-post {
    border-bottom: 1px solid rgba(255,255,255,0.06);
    background: #0d1118;
  }

  /* Post header */
  .fsg-post-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
  }

  .fsg-avatar-wrap {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(135deg, #c9a227, #e05a3a);
    padding: 2px;
    position: relative;
  }
  .fsg-avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    background: #161b24;
  }
  .fsg-avatar-fallback {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #161b24;
    color: #c9a227;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0.5px;
  }

  .fsg-post-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .fsg-username {
    font-size: 13px;
    font-weight: 700;
    color: #e8dfc8;
    letter-spacing: 0.2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fsg-meta-sub {
    font-size: 10px;
    color: rgba(201,162,39,0.65);
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fsg-meta-location {
    font-size: 10px;
    color: rgba(232,223,200,0.35);
    letter-spacing: 0.3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fsg-more-btn {
    background: none;
    border: none;
    padding: 6px;
    cursor: pointer;
    color: rgba(232,223,200,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Post image */
  .fsg-image-wrap {
    width: 100%;
    background: #111318;
    overflow: hidden;
  }
  .fsg-post-img {
    width: 100%;
    display: block;
    max-height: 520px;
    object-fit: cover;
  }

  /* Action bar */
  .fsg-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 4px;
  }
  .fsg-actions-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .fsg-action-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #c9a227;
    transition: transform 0.15s ease, color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .fsg-action-btn:active {
    transform: scale(0.85);
  }
  .fsg-bookmark-btn {
    color: rgba(201,162,39,0.55);
  }

  /* Like button */
  .fsg-like-btn svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    transition: fill 0.2s ease, stroke 0.2s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
  }
  .fsg-like-btn.liked {
    color: #e05a3a;
    animation: fsg-like-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .fsg-like-btn.liked svg {
    fill: #e05a3a;
    stroke: #e05a3a;
  }
  @keyframes fsg-like-pop {
    0%   { transform: scale(1); }
    50%  { transform: scale(1.35); }
    100% { transform: scale(1); }
  }

  /* Post body */
  .fsg-post-body {
    padding: 4px 14px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .fsg-likes {
    font-size: 13px;
    font-weight: 700;
    color: #e8dfc8;
  }
  .fsg-caption {
    font-size: 13px;
    color: rgba(232,223,200,0.8);
    line-height: 1.45;
    margin: 0;
    white-space: pre-line;
  }
  .fsg-caption-user {
    font-weight: 700;
    color: #e8dfc8;
    margin-right: 5px;
  }
  .fsg-tags {
    font-size: 12px;
    color: rgba(201,162,39,0.7);
    margin: 0;
    line-height: 1.4;
  }
  .fsg-view-comments {
    background: none;
    border: none;
    padding: 0;
    font-size: 12px;
    color: rgba(232,223,200,0.3);
    cursor: pointer;
    text-align: left;
    letter-spacing: 0.2px;
  }
  .fsg-top-comment {
    display: flex;
    align-items: baseline;
    gap: 5px;
    flex-wrap: wrap;
  }
  .fsg-top-comment-user {
    font-size: 12px;
    font-weight: 700;
    color: #e8dfc8;
    flex-shrink: 0;
  }
  .fsg-top-comment-text {
    font-size: 12px;
    color: rgba(232,223,200,0.65);
    flex: 1;
    min-width: 0;
  }
  .fsg-top-comment-likes {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    color: rgba(232,223,200,0.3);
    flex-shrink: 0;
    margin-left: auto;
  }
  .fsg-top-comment-likes svg {
    fill: rgba(232,223,200,0.3);
    stroke: none;
  }

  .fsg-timestamp {
    font-size: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(232,223,200,0.22);
    display: block;
    margin-top: 2px;
  }

  .fsg-bottom-spacer {
    height: 24px;
  }
</style>
