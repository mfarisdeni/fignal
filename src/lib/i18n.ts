/**
 * Two languages, one source of truth.
 *
 * Both strings for a key sit on the same line so a translation can never drift
 * away from the text it belongs to, and the type demands both — there is no
 * such thing as a half-translated key. Keys ending in a status or a grade are
 * built from those unions, so a new status cannot ship untranslated.
 *
 * Member-facing numbers never come from here: prices, grades and pairs are the
 * desk's own wording and are shown exactly as published.
 */

export type Language = "en" | "id";

export const DEFAULT_LANGUAGE: Language = "en";

export const LANGUAGE_STORAGE_KEY = "fignal-language";

/** Locale per language, so dates and times read the way the reader expects. */
export const LOCALE: Record<Language, string> = {
  en: "en-GB",
  id: "id-ID",
};

/** Flag-only switcher. The label is for assistive tech and the tooltip, never
 *  for sighted users — the flags are the interface. */
export const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia" },
];

type Message = { en: string; id: string };

export const MESSAGES = {
  /* Navigation */
  "nav.primary": { en: "Primary", id: "Utama" },
  "nav.home": { en: "Fignal Platinum home", id: "Beranda Fignal Platinum" },
  "nav.signals": { en: "Signals", id: "Sinyal" },
  "nav.history": { en: "History", id: "Riwayat" },
  "nav.openMenu": { en: "Open menu", id: "Buka menu" },
  "nav.account": { en: "Account menu", id: "Menu akun" },
  "nav.signOut": { en: "Sign out", id: "Keluar" },
  "nav.member": { en: "Platinum member", id: "Anggota Platinum" },
  "nav.language": { en: "Language", id: "Bahasa" },

  /* Theme */
  "theme.toLight": { en: "Switch to light mode", id: "Beralih ke mode terang" },
  "theme.toDark": { en: "Switch to dark mode", id: "Beralih ke mode gelap" },

  /* Dashboard header */
  "header.title": { en: "Platinum Signals", id: "Sinyal Platinum" },
  "header.subtitle": { en: "Today's market setups", id: "Setup pasar hari ini" },
  "header.updated": { en: "Updated {time}", id: "Diperbarui {time}" },
  "header.updating": { en: "Updating.", id: "Memuat." },
  "header.activeOne": { en: "1 active signal", id: "1 sinyal aktif" },
  "header.activeMany": {
    en: "{n} active signals",
    id: "{n} sinyal aktif",
  },
  "header.feedLive": {
    en: "Signal feed operational",
    id: "Feed sinyal aktif",
  },

  /* Confidence legend */
  "legend.label": { en: "Confidence", id: "Keyakinan" },
  "legend.aria": { en: "Confidence legend", id: "Legenda keyakinan" },

  /* Summary tiles */
  "summary.aria": { en: "Today's summary", id: "Ringkasan hari ini" },
  "summary.signals": { en: "Signals today", id: "Sinyal hari ini" },
  "summary.active": { en: "Active", id: "Aktif" },
  "summary.tp1": { en: "TP1 hit", id: "TP1 kena" },
  "summary.tp2": { en: "TP2 hit", id: "TP2 kena" },
  "summary.sl": { en: "SL hit", id: "SL kena" },
  "summary.winRate": { en: "Win rate", id: "Tingkat kemenangan" },
  "summary.avgConfidence": { en: "Avg confidence", id: "Rata-rata keyakinan" },

  /* Filters */
  "filters.aria": { en: "Signal filters", id: "Filter sinyal" },
  "filters.all": { en: "All", id: "Semua" },
  "filters.active": { en: "Active", id: "Aktif" },
  "filters.completed": { en: "Completed", id: "Selesai" },
  "filters.allAria": { en: "All signals", id: "Semua sinyal" },
  "filters.activeAria": { en: "Active signals", id: "Sinyal aktif" },
  "filters.completedAria": {
    en: "Completed signals",
    id: "Sinyal selesai",
  },

  /* Signal cards */
  "card.entry": { en: "Entry", id: "Entry" },
  "card.stopLoss": { en: "Stop loss", id: "Stop loss" },
  "card.takeProfit1": { en: "Take profit 1", id: "Take profit 1" },
  "card.takeProfit2": { en: "Take profit 2", id: "Take profit 2" },
  "card.entryArea": { en: "Entry area", id: "Area entry" },
  "card.topSetup": { en: "Top setup", id: "Setup unggulan" },
  "card.generated": { en: "Generated {time}", id: "Dibuat {time}" },
  "card.ariaSignal": {
    en: "Signal: {pair} {direction}, status {status}",
    id: "Sinyal: {pair} {direction}, status {status}",
  },
  "card.ariaFeatured": {
    en: "Featured signal: {pair} {direction}",
    id: "Sinyal unggulan: {pair} {direction}",
  },

  /* Empty states */
  "empty.noSetup": { en: "{pair} - No valid setup", id: "{pair} - Tidak ada setup" },
  "empty.noSetupGeneric": {
    en: "No valid setup",
    id: "Tidak ada setup",
  },
  "empty.waiting": {
    en: "Fignal is waiting for a clearer market structure.",
    id: "Fignal sedang menunggu struktur pasar yang lebih jelas.",
  },
  "empty.noActive": {
    en: "No active signals right now. New setups are published as the structure develops.",
    id: "Belum ada sinyal aktif. Setup baru dipublikasikan seiring terbentuknya struktur.",
  },
  "empty.noCompleted": {
    en: "No completed signals yet. Results appear here as targets or stops are reached.",
    id: "Belum ada sinyal selesai. Hasil muncul di sini setelah target atau stop tercapai.",
  },
  "empty.noBtc": {
    en: "No BTC setup published. Weekend analyses appear here as the desk releases them.",
    id: "Belum ada setup BTC. Analisis akhir pekan muncul di sini saat desk menerbitkannya.",
  },
  "empty.noPublished": {
    en: "No signals published yet. Setups appear here as they are released.",
    id: "Belum ada sinyal dipublikasikan. Setup muncul di sini saat diterbitkan.",
  },

  /* History */
  "history.title": { en: "Recent history", id: "Riwayat terbaru" },
  "history.viewAll": { en: "View all", id: "Lihat semua" },
  "history.empty": {
    en: "No completed signals yet. Results appear here as setups close.",
    id: "Belum ada sinyal selesai. Hasil muncul di sini setelah setup selesai.",
  },
  "history.ungraded": { en: "Ungraded", id: "Tanpa grade" },

  /* Risk notice */
  "risk.title": { en: "Risk notice.", id: "Catatan risiko." },
  "risk.body": {
    en: "Trading involves significant risk. Signals are analytical information and are not a guarantee of future results.",
    id: "Trading mengandung risiko signifikan. Sinyal adalah informasi analitis dan bukan jaminan hasil di masa depan.",
  },

  /* Member gate */
  "auth.title": { en: "Platinum Members Only", id: "Khusus Member Platinum" },
  "auth.subtitle": {
    en: "Sign in to access the latest Fignal signals.",
    id: "Masuk untuk mengakses sinyal Fignal terbaru.",
  },
  "auth.signIn": { en: "Sign In", id: "Masuk" },
  "auth.join": { en: "Join Platinum", id: "Gabung Platinum" },
  "auth.joinAria": {
    en: "Join Platinum (checkout coming soon)",
    id: "Gabung Platinum (checkout segera hadir)",
  },

  /* Admin gate */
  "adminGate.title": { en: "Admin access", id: "Akses admin" },
  "adminGate.subtitle": {
    en: "Enter the desk passcode to publish analyses.",
    id: "Masukkan passcode desk untuk mempublikasikan analisis.",
  },
  "adminGate.passcode": { en: "Admin passcode", id: "Passcode admin" },
  "adminGate.unlock": { en: "Unlock", id: "Buka" },
  "adminGate.wrong": {
    en: "Wrong passcode. Try again.",
    id: "Passcode salah. Coba lagi.",
  },

  /* Admin desk */
  "admin.memberView": { en: "Member view", id: "Tampilan member" },
  "admin.lock": { en: "Lock the admin desk", id: "Kunci admin desk" },
  "admin.publishTitle": {
    en: "Publish an analysis",
    id: "Publikasikan analisis",
  },
  "admin.publishSubtitle": {
    en: "The prompt is stored as-is and read for its summary numbers.",
    id: "Prompt disimpan apa adanya dan dibaca untuk angka ringkasannya.",
  },
  "admin.publishedTitle": {
    en: "Published analyses",
    id: "Analisis yang dipublikasikan",
  },
  "admin.total": { en: "{n} total", id: "{n} total" },
  "admin.empty": {
    en: "Submit a prompt to publish its entry, stop loss, targets and confidence to the member feed.",
    id: "Kirim prompt untuk mempublikasikan entry, stop loss, target, dan keyakinan ke feed member.",
  },
  "admin.publishedWith": {
    en: "{pair} published with {fields}.",
    id: "{pair} dipublikasikan dengan {fields}.",
  },
  "admin.publishedNoLevels": {
    en: "{pair} published, but no levels were found - check the prompt.",
    id: "{pair} dipublikasikan, tetapi tidak ada level ditemukan - periksa prompt.",
  },
  "admin.missing": {
    en: "Not stated in the prompt: {fields}. Left blank on the member card rather than guessed.",
    id: "Tidak disebutkan dalam prompt: {fields}. Dikosongkan di kartu member, bukan ditebak.",
  },
  "admin.missingPair": { en: "pair", id: "pair" },
  "admin.missingEntry": { en: "entry", id: "entry" },
  "admin.missingSl": { en: "stop loss", id: "stop loss" },
  "admin.missingTp": { en: "targets", id: "target" },
  "admin.missingConfidence": {
    en: "confidence",
    id: "keyakinan",
  },
  "admin.riskReward": { en: "Risk / reward", id: "Risk / reward" },
  "admin.sniper": { en: "Sniper trigger", id: "Trigger sniper" },
  "admin.invalidation": { en: "Invalidation", id: "Invalidasi" },
  "admin.reason": { en: "Reason", id: "Alasan" },
  "admin.statusLabel": { en: "Signal status", id: "Status sinyal" },
  "admin.statusAria": {
    en: "Status for {pair} analysis",
    id: "Status untuk analisis {pair}",
  },
  "admin.rawPrompt": {
    en: "Raw prompt ({n} chars)",
    id: "Prompt asli ({n} karakter)",
  },
  "admin.noTrade": { en: "No trade", id: "Tidak ada trade" },
  "admin.ariaRecord": {
    en: "Analysis: {pair} {call}, confidence {confidence}",
    id: "Analisis: {pair} {call}, keyakinan {confidence}",
  },
  "admin.ariaDelete": {
    en: "Delete {pair} analysis",
    id: "Hapus analisis {pair}",
  },

  /* Prompt form */
  "form.label": { en: "Analysis prompt", id: "Prompt analisis" },
  "form.chars": { en: "{n} chars", id: "{n} karakter" },
  "form.help": {
    en: "Extracted on submit: pair, decision, confidence, entry, stop loss, TP1 and TP2. Fields the prompt does not state are reported as missing rather than guessed.",
    id: "Diekstrak saat dikirim: pair, keputusan, keyakinan, entry, stop loss, TP1, dan TP2. Kolom yang tidak disebutkan prompt dilaporkan kosong, bukan ditebak.",
  },
  "form.submit": {
    en: "Extract & publish",
    id: "Ekstrak & publikasikan",
  },

  /* Landing */
  "landing.title": {
    en: "Trade the setup, not the noise.",
    id: "Trade the setup, bukan noise.",
  },
  "landing.subtitle": {
    en: "Structured market analysis with a stated entry, stop loss, targets and confidence grade - for Platinum members only.",
    id: "Analisis pasar terstruktur dengan entry, stop loss, target, dan grade keyakinan yang jelas - khusus member Platinum.",
  },
  "landing.subscribe": { en: "Subscribe", id: "Berlangganan" },

  /* Per-status labels, built from the status union */
  "status.UPCOMING": { en: "Upcoming", id: "Mendatang" },
  "status.ACTIVE": { en: "Active", id: "Aktif" },
  "status.ENTRY_HIT": { en: "Entry hit", id: "Entry kena" },
  "status.TP1_HIT": { en: "TP1 hit", id: "TP1 kena" },
  "status.TP2_HIT": { en: "TP2 hit", id: "TP2 kena" },
  "status.SL_HIT": { en: "SL hit", id: "SL kena" },
  "status.EXPIRED": { en: "Expired", id: "Kedaluwarsa" },
  "status.CANCELLED": { en: "Cancelled", id: "Dibatalkan" },
  "status.NO_TRADE": { en: "No trade", id: "Tidak ada trade" },

  /* The parser's own classification, used when a prompt has no decision line */
  "call.enter": { en: "Enter", id: "Enter" },
  "call.wait": { en: "Wait", id: "Wait" },
  "call.noTrade": { en: "No trade", id: "Tidak ada trade" },

  "direction.noSide": { en: "No side", id: "Tanpa arah" },

  /* Per-grade labels, built from the confidence union */
  "conf.A+": { en: "Highest confidence", id: "Keyakinan tertinggi" },
  "conf.A": { en: "High confidence", id: "Keyakinan tinggi" },
  "conf.B+": {
    en: "Moderate-high confidence",
    id: "Keyakinan cukup tinggi",
  },
  "conf.B": { en: "Moderate confidence", id: "Keyakinan sedang" },

  /* Trading session, from the clock in WIB */
  "session.sydneyTokyo": {
    en: "Sydney / Tokyo session",
    id: "Sesi Sydney / Tokyo",
  },
  "session.asia": { en: "Asia session", id: "Sesi Asia" },
  "session.londonNewYork": {
    en: "London / New York session",
    id: "Sesi London / New York",
  },
  "session.weekend": {
    en: "{day} · Weekend — BTC focus",
    id: "{day} · Akhir pekan — fokus BTC",
  },

  /* Parsed fields, named in the admin's language */
  "field.entry": { en: "entry", id: "entry" },
  "field.sl": { en: "SL", id: "SL" },
  "field.tp1": { en: "TP1", id: "TP1" },
  "field.tp2": { en: "TP2", id: "TP2" },
  "field.grade": { en: "grade {confidence}", id: "grade {confidence}" },
} satisfies Record<string, Message>;

export type StaticMessageKey = keyof typeof MESSAGES;

/**
 * Keys a component may build at runtime. Listing them here means
 * `t(\`status.${status}\`)` type-checks as long as a label exists for every
 * member of the union.
 */
export type MessageKey =
  | StaticMessageKey
  | `status.${import("@/types/signal").SignalStatus | "NO_TRADE"}`
  | `conf.${import("@/types/signal").Confidence}`
  | "field.entry"
  | "field.sl"
  | "field.tp1"
  | "field.tp2"
  | "field.grade";

export type MessageVars = Record<string, string | number>;

/**
 * Look up a message and fill its placeholders. An unknown key falls back to the
 * key itself rather than rendering an empty gap in the UI.
 */
export function translate(
  language: Language,
  key: MessageKey,
  vars?: MessageVars,
): string {
  const entry = MESSAGES[key as StaticMessageKey];
  let text: string = entry?.[language] ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
