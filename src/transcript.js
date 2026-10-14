// ============================================================
//  Transcript Fetcher
//  YouTube often blocks the simple caption URL, so this tries
//  several methods in order and uses the first one that works:
//   A. Turn CC on briefly and reuse the player's signed caption URL
//   B. Read the transcript panel if the user has already opened it
//   C. YouTube's internal get_transcript API
//   D. The plain caption URL
// ============================================================

export class TranscriptFetcher {
  constructor(signal) {
    this.signal = signal;
  }
  _signal(timeout = 15000) {
    return this.signal
      ? AbortSignal.any([this.signal, AbortSignal.timeout(timeout)])
      : AbortSignal.timeout(timeout);
  }
  _decodeCaptions(text) {
    try {
      const data = JSON.parse(text);
      return (data.events || [])
        .filter((e) => e.segs)
        .map((e) => ({
          text: e.segs
            .map((s) => s.utf8 || "")
            .join("")
            .replace(/\s+/g, " ")
            .trim(),
          startTime: (e.tStartMs || 0) / 1000,
        }))
        .filter((e) => e.text);
    } catch {}
    const xml = new DOMParser().parseFromString(text, "text/xml");
    if (xml.querySelector("parsererror")) return [];
    return [...xml.querySelectorAll("text[start], p[t]")]
      .map((e) => ({
        text: e.textContent.replace(/\s+/g, " ").trim(),
        startTime: e.hasAttribute("start")
          ? Number(e.getAttribute("start"))
          : Number(e.getAttribute("t")) / 1000,
      }))
      .filter((e) => e.text && Number.isFinite(e.startTime));
  }
  _visibleTranscript() {
    const els = document.querySelectorAll(
      "ytd-transcript-segment-renderer, transcript-segment-view-model",
    );
    return [...els]
      .map((el) => {
        const raw = (el.innerText || el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const m = raw.match(/^((?:\d+:)?\d{1,2}:\d{2})\s*(.*)$/);
        if (!m) return null;
        const startTime = m[1]
          .split(":")
          .map(Number)
          .reduce((a, n) => a * 60 + n, 0);
        const label = m[2].match(
          /^(?:\d+\s+(?:hours?|minutes?|seconds?),?\s*)+/,
        )?.[0];
        const labelSeconds = label
          ? [...label.matchAll(/(\d+)\s+(hours?|minutes?|seconds?)/g)].reduce(
              (sum, x) =>
                sum +
                Number(x[1]) *
                  (x[2].startsWith("hour")
                    ? 3600
                    : x[2].startsWith("minute")
                      ? 60
                      : 1),
              0,
            )
          : -1;
        return {
          text: (
            el.querySelector?.(".segment-text")?.textContent ||
            (labelSeconds === startTime ? m[2].slice(label.length) : m[2])
          ).trim(),
          startTime,
        };
      })
      .filter((s) => s?.text);
  }

  async fetch(videoId) {
    // An ad blocks the real player: wait for it to finish first
    await this._waitForRealVideo();
    const openVideo =
      new URLSearchParams(globalThis.location?.search).get("v") === videoId;
    if (openVideo) {
      const transcript = this._visibleTranscript();
      if (transcript.length)
        return {
          title: this._domTitle(),
          channel: this._domChannel(),
          transcript,
          source: "visible transcript",
        };
    }

    // Use the loaded watch page first. A second watch request can receive a
    // login challenge even when the user's current player is working.
    let html = [...document.querySelectorAll("script:not([src])")]
      .map((s) => s.textContent || "")
      .join("\n");
    let pagePlayer = this._parse(html, "ytInitialPlayerResponse = ");
    if (pagePlayer?.videoDetails?.videoId !== videoId) {
      html = ""; // Inline boot data can belong to the previous SPA video.
      pagePlayer = null;
    }
    try {
      if (!html) {
        const response = await fetch(
          `https://www.youtube.com/watch?v=${videoId}`,
          {
            credentials: "include",
            signal: this._signal(5000),
          },
        );
        if (response.ok) html = await response.text();
      }
    } catch {
      // Page metadata may be blocked; still try the visible player's captions.
    }

    const player = this._parse(html, "ytInitialPlayerResponse = ") || {};
    const initialData =
      this._parse(html, "ytInitialData = ") ||
      this._parse(html, 'window["ytInitialData"] = ') ||
      {};

    const title = player.videoDetails?.title || this._domTitle();
    const channel = player.videoDetails?.author || this._domChannel();
    const errorScreen = document.querySelector(
      "yt-playability-error-supported-renderers yt-player-interstitial-renderer, .ytp-error-content-wrap",
    );
    const visibleError = (
      errorScreen?.getAttribute?.("aria-label") ||
      errorScreen?.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const blockedReason =
      visibleError ||
      (pagePlayer?.playabilityStatus?.status !== "OK"
        ? pagePlayer?.playabilityStatus?.reason
        : "");
    if (blockedReason) {
      return {
        title,
        channel,
        transcript: [],
        status: "blocked",
        message: String(blockedReason).slice(0, 300),
        needsAudio: false,
      };
    }

    const errors = [];
    const isOpenVideo =
      new URLSearchParams(location.search).get("v") === videoId;
    const methods = [
      ...(isOpenVideo
        ? [
            ["visible transcript", () => this._visibleTranscript()],
            ["player captions", () => this._viaPlayerCaptions(videoId)],
          ]
        : []),
      ["get_transcript", () => this._viaInnertube(html, initialData)],
      ["caption url", () => this._viaCaptionTrack(player)],
      ...(isOpenVideo
        ? [["YouTube transcript panel", () => this._viaDomPanel(videoId)]]
        : []),
    ];

    for (const [name, run] of methods) {
      if (this.signal?.aborted)
        throw new Error("Video navigation cancelled caption capture.");
      try {
        const transcript = await run();
        if (transcript && transcript.length) {
          if (
            isOpenVideo &&
            new URLSearchParams(location.search).get("v") !== videoId
          )
            throw new Error("Video changed during caption fetch");
          console.log(
            `[TranscriptFetcher] ✅ Got ${transcript.length} segments via ${name}`,
          );
          return { title, channel, transcript, source: name };
        }
        errors.push(`${name}: empty`);
      } catch (e) {
        errors.push(`${name}: ${e.message}`);
      }
    }

    console.info(
      "[TranscriptFetcher] Caption methods unavailable: " +
        JSON.stringify(errors),
    );

    // Tell the two cases apart: no captions at all vs. something else
    const hasCaptionTracks =
      (player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [])
        .length > 0;
    const hasCcButton = !!document.querySelector(
      '.ytp-subtitles-button:not([style*="display: none"])',
    );

    return {
      title,
      channel,
      transcript: [],
      needsAudio: true,
      status: "unavailable",
      message:
        hasCaptionTracks || hasCcButton
          ? "YouTube caption requests failed. Retry captions when the video plays normally."
          : "No usable caption source found. Audio transcription is available.",
    };
  }

  // ── Method C: youtubei get_transcript ─────────────────────
  async _viaInnertube(html, initialData) {
    const params = this._findKey(initialData, "getTranscriptEndpoint")?.params;
    if (!params) throw new Error("no transcript button on this video");

    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
    const clientVersion =
      html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ||
      "2.20250101.00.00";
    const context = this._parse(html, '"INNERTUBE_CONTEXT":') || {
      client: { clientName: "WEB", clientVersion, hl: "en" },
    };

    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/get_transcript${apiKey ? "?key=" + apiKey : ""}`,
      {
        method: "POST",
        signal: this._signal(),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-YouTube-Client-Name": "1",
          "X-YouTube-Client-Version": clientVersion,
        },
        body: JSON.stringify({ context, params }),
      },
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    const segments = this._findKey(data, "initialSegments") || [];
    return segments
      .map((s) => s.transcriptSegmentRenderer)
      .filter(Boolean)
      .map((r) => ({
        text: (r.snippet?.runs || [])
          .map((x) => x.text)
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
        startTime: Number(r.startMs || 0) / 1000,
      }))
      .filter((s) => s.text);
  }

  // ── Method D: caption track (timedtext) ───────────────────
  async _viaCaptionTrack(player) {
    const tracks =
      player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    if (!tracks.length) throw new Error("no caption tracks");

    const track =
      tracks.find(
        (t) => t.languageCode?.startsWith("en") && t.kind !== "asr",
      ) ||
      tracks.find((t) => t.languageCode?.startsWith("en")) ||
      tracks[0];

    const text = await (
      await fetch(track.baseUrl, {
        credentials: "include",
        signal: this._signal(),
      })
    ).text();
    if (!text) throw new Error("blocked by YouTube (empty response)");
    return this._decodeCaptions(text);
  }

  // ── Method A: let YouTube's own player load the captions ──
  // YouTube now signs caption requests (a "pot" token). The player
  // makes a signed request when CC is turned on, so we briefly turn
  // CC on, read the signed URL from the browser's network timing
  // list, fetch it ourselves, and restore CC to how it was.
  async _viaPlayerCaptions(videoId) {
    const findUrl = () =>
      performance
        .getEntriesByType("resource")
        .map((e) => e.name)
        .reverse()
        .find((u) => {
          try {
            const candidate = new URL(u);
            return (
              candidate.hostname === "www.youtube.com" &&
              candidate.pathname === "/api/timedtext" &&
              candidate.searchParams.get("v") === videoId
            );
          } catch {
            return false;
          }
        });

    let url = findUrl();
    const ccBtn = document.querySelector(".ytp-subtitles-button");
    let toggled = false;

    if (!url) {
      if (!ccBtn || ccBtn.style.display === "none")
        throw new Error("no CC button");
      if (ccBtn.getAttribute("aria-pressed") !== "true") {
        ccBtn.click();
        toggled = true;
      }
      try {
        for (let i = 0; i < 25 && !url; i++) {
          await this._sleep(200);
          url = findUrl();
        }
      } finally {
        if (
          toggled &&
          ccBtn.isConnected &&
          ccBtn.getAttribute("aria-pressed") === "true"
        )
          ccBtn.click();
      }
    }
    if (!url) throw new Error("player did not load captions");

    const text = await (
      await fetch(url, {
        credentials: "include",
        signal: this._signal(),
      })
    ).text();
    if (!text) throw new Error("empty");
    return this._decodeCaptions(text);
  }

  // ── Method B: open "Show transcript" panel and read it ────
  async _viaDomPanel(videoId) {
    const readSegments = () => this._visibleTranscript();

    let segments = readSegments();
    if (segments.length) return segments;

    document
      .querySelector(
        "#description-inline-expander #expand, tp-yt-paper-button#expand",
      )
      ?.click();
    await this._sleep(700);

    const btn =
      document.querySelector(
        "ytd-video-description-transcript-section-renderer button",
      ) ||
      [...document.querySelectorAll("button, yt-button-shape button")].find(
        (b) =>
          /transcript/i.test(
            b.getAttribute("aria-label") || b.textContent || "",
          ),
      );
    if (!btn) throw new Error('"Show transcript" button not found');
    btn.click();

    for (let i = 0; i < 40; i++) {
      // wait up to ~12s
      await this._sleep(300);
      segments = readSegments();
      if (segments.length) {
        await this._sleep(500); // let the rest render
        segments = readSegments();
        break;
      }
    }

    document
      .querySelector(
        'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] #visibility-button button',
      )
      ?.click();
    if (!segments.length) throw new Error("panel opened but no text found");
    return segments;
  }

  // ── Helpers ───────────────────────────────────────────────
  _parse(html, marker) {
    const start = html.indexOf(marker);
    if (start === -1) return null;
    const i = html.indexOf("{", start);
    let depth = 0,
      inStr = false,
      esc = false;
    for (let j = i; j < html.length; j++) {
      const ch = html[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  // Depth-first search for the first property with this name
  _findKey(obj, key) {
    const stack = [obj];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      if (Object.prototype.hasOwnProperty.call(cur, key)) return cur[key];
      for (const v of Object.values(cur))
        if (v && typeof v === "object") stack.push(v);
    }
    return null;
  }

  _domTitle() {
    return (
      document
        .querySelector("h1.ytd-watch-metadata yt-formatted-string")
        ?.textContent?.trim() ||
      document.title.replace(/ - YouTube$/, "").trim() ||
      "Unknown Title"
    );
  }

  _domChannel() {
    return (
      document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
      "Unknown Channel"
    );
  }

  // Wait until an ad has finished and the real video is playing
  async _waitForRealVideo() {
    for (let i = 0; i < 60; i++) {
      // up to ~60s
      const player = document.querySelector("#movie_player");
      if (!player) {
        await this._sleep(1000);
        continue;
      }
      const adShowing =
        player.classList.contains("ad-showing") ||
        player.classList.contains("ad-interrupting") ||
        document.querySelector(".ytp-ad-player-overlay, .ad-showing");
      if (!adShowing) return;
      console.log("[TranscriptFetcher] Ad playing, waiting...");
      await this._sleep(1000);
    }
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms)).then(() => {
      if (this.signal?.aborted)
        throw new Error("Video navigation cancelled caption capture.");
    });
  }
}
