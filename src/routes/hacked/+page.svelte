<script>
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { dbGet } from '$lib/firebase-db.js';

  let username = '';
  let password = '';
  let error = '';
  let authenticating = false;
  let usernameEl;

  async function attemptLogin() {
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { error = 'USERNAME AND PASSWORD REQUIRED'; return; }
    authenticating = true;
    error = '';
    try {
      const data = await dbGet('device-accounts');
      const accounts = data ? Object.values(data) : [];
      const match = accounts.find(a =>
        a.username?.toLowerCase() === u.toLowerCase() && a.password === p
      );
      if (!match) {
        error = 'ACCESS DENIED — INVALID CREDENTIALS';
        authenticating = false;
        return;
      }
      await goto(`${base}/hacked/home?npc=${encodeURIComponent(match.npcKey)}`);
    } catch {
      error = 'CONNECTION FAILED — TRY AGAIN';
      authenticating = false;
    }
  }

  function onKeydown(e) {
    if (e.key === 'Enter') attemptLogin();
    else error = '';
  }
</script>

<svelte:head>
  <title>Fate City: 1999 — Terminal</title>
</svelte:head>

<div class="term-wrap">
  <div class="term-panel">
    <div class="term-scanline" aria-hidden="true"></div>
    <p class="term-sys">// REMOTE ACCESS TERMINAL — UNAUTHORIZED USE IS A CRIME</p>
    <div class="term-divider" aria-hidden="true"></div>

    <h1 class="term-title">LOGIN</h1>
    <p class="term-sub">Enter a device's login credentials to view what's on it.</p>

    <div class="term-field-wrap">
      <span class="term-label" aria-hidden="true">USER</span>
      <input
        class="term-input"
        type="text"
        bind:value={username}
        bind:this={usernameEl}
        on:keydown={onKeydown}
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
    </div>
    <div class="term-field-wrap">
      <span class="term-label" aria-hidden="true">PASS</span>
      <input
        class="term-input"
        type="password"
        bind:value={password}
        on:keydown={onKeydown}
        autocomplete="off"
      />
    </div>

    {#if error}
      <p class="term-error" role="alert">{error}</p>
    {/if}

    <button class="term-confirm" disabled={authenticating} on:click={attemptLogin}>
      {authenticating ? 'AUTHENTICATING…' : 'CONNECT'}
    </button>

    <a class="term-back" href="{base}/home">&larr; Back to your own device</a>
  </div>
</div>

<style>
  .term-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #050608;
    padding: 24px;
  }

  .term-panel {
    position: relative;
    width: 100%;
    max-width: 360px;
    background: #0a0a0c;
    border: 1px solid rgba(192, 80, 74, 0.5);
    border-radius: 4px;
    padding: 28px 24px 22px;
    box-shadow: 0 0 40px rgba(192, 80, 74, 0.15), 0 0 80px rgba(192, 80, 74, 0.06);
    overflow: hidden;
  }
  .term-scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0, 0, 0, 0.2) 3px,
      rgba(0, 0, 0, 0.2) 4px
    );
  }
  .term-sys {
    font-family: 'Courier New', Courier, monospace;
    font-size: 9px;
    letter-spacing: 1.2px;
    color: rgba(192, 80, 74, 0.6);
    text-transform: uppercase;
    margin: 0 0 10px;
  }
  .term-divider {
    height: 1px;
    background: linear-gradient(to right, rgba(192, 80, 74, 0.6), transparent);
    margin-bottom: 20px;
  }
  .term-title {
    font-family: 'Courier New', Courier, monospace;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 4px;
    color: #e8dfc8;
    margin: 0 0 8px;
  }
  .term-sub {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: rgba(232, 223, 200, 0.45);
    margin: 0 0 22px;
  }
  .term-field-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(192, 80, 74, 0.35);
    border-radius: 3px;
    padding: 10px 12px;
    background: rgba(192, 80, 74, 0.04);
    margin-bottom: 10px;
  }
  .term-label {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 1.5px;
    color: rgba(192, 80, 74, 0.7);
    flex-shrink: 0;
    width: 40px;
  }
  .term-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #e8dfc8;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    letter-spacing: 1px;
    caret-color: #c0504a;
  }
  .term-error {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    letter-spacing: 1px;
    color: #ff6b6b;
    margin: 8px 0 0;
    text-transform: uppercase;
  }
  .term-confirm {
    width: 100%;
    padding: 13px;
    margin-top: 16px;
    background: linear-gradient(135deg, rgba(192, 80, 74, 0.2), rgba(192, 80, 74, 0.08));
    border: 1px solid rgba(192, 80, 74, 0.6);
    border-radius: 3px;
    color: #ff8a80;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s, box-shadow 0.2s;
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
  }
  .term-confirm:disabled { opacity: 0.5; cursor: default; }
  .term-confirm:not(:disabled):active {
    background: rgba(192, 80, 74, 0.3);
    box-shadow: 0 0 16px rgba(192, 80, 74, 0.3);
  }
  .term-back {
    display: block;
    text-align: center;
    margin-top: 18px;
    font-size: 10px;
    letter-spacing: 1px;
    color: rgba(232, 223, 200, 0.25);
    text-decoration: none;
  }
  .term-back:hover { color: rgba(232, 223, 200, 0.5); }
</style>
