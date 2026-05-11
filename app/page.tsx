"use client";

import {
  Activity,
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  Disc3,
  Filter,
  Headphones,
  Inbox,
  LayoutGrid,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  Waves,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "producer-os-tracks-v1";

const STATUSES = [
  "Idea",
  "Arrangement",
  "Mixing",
  "Mastering",
  "Ready",
  "Released",
] as const;

const PRIORITIES = ["Low", "Medium", "High"] as const;

type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type Track = {
  id: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  status: Status;
  priority: Priority;
  nextStep: string;
  notes: string;
  checklist: ChecklistItem[];
};

type FilterId = "all" | "mixing" | "ready" | "high";

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "c1", label: "Final master locked", done: false },
  { id: "c2", label: "Artwork & branding ready", done: false },
  { id: "c3", label: "Credits / splits documented", done: false },
  { id: "c4", label: "DSP metadata complete", done: false },
  { id: "c5", label: "Release day promo queued", done: false },
];

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyForm() {
  return {
    title: "",
    bpm: 120,
    key: "",
    genre: "",
    status: "Idea" as Status,
    priority: "Medium" as Priority,
    nextStep: "",
    notes: "",
  };
}

function parseTracks(raw: string | null): Track[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidTrack);
  } catch {
    return [];
  }
}

function isValidTrack(x: unknown): x is Track {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.bpm === "number" &&
    typeof t.key === "string" &&
    typeof t.genre === "string" &&
    STATUSES.includes(t.status as Status) &&
    PRIORITIES.includes(t.priority as Priority) &&
    typeof t.nextStep === "string" &&
    typeof t.notes === "string" &&
    Array.isArray(t.checklist)
  );
}

/** Richer set for “Load demo tracks” and screenshot-friendly density */
const LOAD_DEMO_TRACKS: Track[] = [
  {
    id: "demo-1",
    title: "Neon Afterglow",
    bpm: 92,
    key: "Fm",
    genre: "Synthwave",
    status: "Mixing",
    priority: "High",
    nextStep: "Vocal ride automation + bus glue",
    notes: "Reference: FM-84 — keep drums wide, bass mono.",
    checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, done: c.id === "c1" })),
  },
  {
    id: "demo-2",
    title: "Basement Tape 04",
    bpm: 140,
    key: "Am",
    genre: "House",
    status: "Ready",
    priority: "Medium",
    nextStep: "Send to distro — Friday",
    notes: "Swap clap layer if master feels thin.",
    checklist: DEFAULT_CHECKLIST.map((c) => ({
      ...c,
      done: ["c1", "c2", "c3"].includes(c.id),
    })),
  },
  {
    id: "demo-3",
    title: "Glassline (VIP)",
    bpm: 174,
    key: "G#m",
    genre: "DnB",
    status: "Mastering",
    priority: "Low",
    nextStep: "Loudness pass vs reference — leave 1 dB headroom",
    notes: "VIP drops at 2:08 — keep hats mono-compatible.",
    checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, done: c.id === "c1" })),
  },
  {
    id: "demo-4",
    title: "Lobby FM",
    bpm: 85,
    key: "Bb",
    genre: "Lo-fi",
    status: "Released",
    priority: "Medium",
    nextStep: "Post-mortem: bounce stems for remix pack",
    notes: "Released 04/01 — add to catalog sheet.",
    checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, done: true })),
  },
];

const DEMO_TRACKS: Track[] = LOAD_DEMO_TRACKS.slice(0, 2);

type SampleRow = {
  title: string;
  bpm: number;
  key: string;
  genre: string;
  status: Status;
  priority: Priority;
  nextStep: string;
  checklistPreview: { done: boolean; label: string }[];
};

const SAMPLE_DASHBOARD_ROWS: SampleRow[] = [
  {
    title: "Midnight Relay",
    bpm: 118,
    key: "Dm",
    genre: "Electronica",
    status: "Mixing",
    priority: "High",
    nextStep: "Glue bus + vocal de-esser pass",
    checklistPreview: [
      { done: true, label: "Final master locked" },
      { done: false, label: "Artwork & branding ready" },
      { done: false, label: "DSP metadata complete" },
    ],
  },
  {
    title: "Velvet Runner",
    bpm: 124,
    key: "F#",
    genre: "Disco house",
    status: "Ready",
    priority: "Medium",
    nextStep: "Schedule distro upload — Tuesday",
    checklistPreview: [
      { done: true, label: "Final master locked" },
      { done: true, label: "Artwork & branding ready" },
      { done: false, label: "Release day promo queued" },
    ],
  },
  {
    title: "Static Bloom",
    bpm: 72,
    key: "Em",
    genre: "Ambient",
    status: "Idea",
    priority: "Low",
    nextStep: "Capture 8-bar motif — phone memo → DAW",
    checklistPreview: [
      { done: false, label: "Final master locked" },
      { done: false, label: "Credits / splits documented" },
    ],
  },
];

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [form, setForm] = useState(emptyForm);
  const [showSampleLayout, setShowSampleLayout] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    startTransition(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        setTracks(DEMO_TRACKS);
      } else {
        setTracks(parseTracks(raw));
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
  }, [tracks, hydrated]);

  const stats = useMemo(() => {
    const total = tracks.length;
    const mixing = tracks.filter((t) => t.status === "Mixing").length;
    const ready = tracks.filter((t) => t.status === "Ready").length;
    const released = tracks.filter((t) => t.status === "Released").length;
    return { total, mixing, ready, released };
  }, [tracks]);

  const filtered = useMemo(() => {
    return tracks.filter((t) => {
      if (filter === "all") return true;
      if (filter === "mixing") return t.status === "Mixing";
      if (filter === "ready") return t.status === "Ready";
      if (filter === "high") return t.priority === "High";
      return true;
    });
  }, [tracks, filter]);

  const filterEmpty = hydrated && filtered.length === 0;
  const libraryEmpty = hydrated && tracks.length === 0;

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("screenshot")) return;
    if (tracks.length === 0 || filtered.length === 0) {
      startTransition(() => setShowSampleLayout(true));
    }
  }, [hydrated, tracks.length, filtered.length]);

  const addTrack = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const title = form.title.trim();
      if (!title) return;
      const track: Track = {
        id: newId(),
        title,
        bpm: Number.isFinite(form.bpm) ? Math.min(300, Math.max(40, form.bpm)) : 120,
        key: form.key.trim(),
        genre: form.genre.trim(),
        status: form.status,
        priority: form.priority,
        nextStep: form.nextStep.trim(),
        notes: form.notes.trim(),
        checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c, id: `${newId()}-${c.id}` })),
      };
      setTracks((prev) => [track, ...prev]);
      setForm(emptyForm());
    },
    [form]
  );

  const deleteTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateTrack = useCallback((id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const toggleChecklist = useCallback((trackId: string, itemId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          checklist: t.checklist.map((c) =>
            c.id === itemId ? { ...c, done: !c.done } : c
          ),
        };
      })
    );
  }, []);

  const loadDemoTracks = useCallback(() => {
    setTracks(
      LOAD_DEMO_TRACKS.map((t) => ({
        ...t,
        id: newId(),
        checklist: t.checklist.map((c) => ({ ...c, id: newId() })),
      }))
    );
    setFilter("all");
    setShowSampleLayout(false);
  }, []);

  const filterTabs: { id: FilterId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "mixing", label: "Mixing" },
    { id: "ready", label: "Ready" },
    { id: "high", label: "High Priority" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.35),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {/* Header / hero */}
        <header className="mb-10 flex flex-col gap-6 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
              <Sparkles className="size-3.5 text-violet-300" aria-hidden />
              ProducerOS · local-first workflow
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your release pipeline,{" "}
                <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  one dashboard
                </span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Track ideas through arrangement, mixing, mastering, and release. Filter
                what matters, capture next steps, and ship with a checklist that stays
                with each record.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur">
            <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
              <Disc3 className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Session
              </p>
              <p className="text-sm font-medium text-white">
                {hydrated ? `${tracks.length} in library` : "…"}
              </p>
            </div>
          </div>
        </header>

        {/* Stats */}
        <section
          className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Pipeline stats"
        >
          <StatCard
            label="Total tracks"
            value={hydrated ? stats.total : "—"}
            icon={Music2}
            accent="from-violet-500/30 to-transparent"
          />
          <StatCard
            label="Mixing"
            value={hydrated ? stats.mixing : "—"}
            icon={Waves}
            accent="from-cyan-500/25 to-transparent"
          />
          <StatCard
            label="Ready"
            value={hydrated ? stats.ready : "—"}
            icon={Headphones}
            accent="from-emerald-500/25 to-transparent"
          />
          <StatCard
            label="Released"
            value={hydrated ? stats.released : "—"}
            icon={Activity}
            accent="from-fuchsia-500/25 to-transparent"
          />
        </section>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Add track */}
          <aside className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              <Plus className="size-4" aria-hidden />
              New track
            </h2>
            <form
              onSubmit={addTrack}
              className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-xl shadow-black/40 backdrop-blur"
            >
              <Field label="Title" required>
                <input
                  ref={titleInputRef}
                  id="produceros-new-track-title"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Untitled bounce"
                  autoComplete="off"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="BPM">
                  <input
                    type="number"
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    min={40}
                    max={300}
                    value={form.bpm}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, bpm: Number(e.target.value) }))
                    }
                  />
                </Field>
                <Field label="Key">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    value={form.key}
                    onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                    placeholder="Am"
                  />
                </Field>
              </div>
              <Field label="Genre">
                <input
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  value={form.genre}
                  onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                  placeholder="House, trap, ambient…"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as Status }))
                    }
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value as Priority }))
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Next step">
                <input
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  value={form.nextStep}
                  onChange={(e) => setForm((f) => ({ ...f, nextStep: e.target.value }))}
                  placeholder="What happens next in the session?"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className="min-h-[88px] w-full resize-y rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="References, mix notes, collaborators…"
                />
              </Field>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:brightness-110 active:scale-[0.99]"
              >
                <Plus className="size-4" aria-hidden />
                Add to pipeline
              </button>
            </form>
          </aside>

          {/* Track list */}
          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                <Filter className="size-4" aria-hidden />
                Library
              </h2>
              <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Filter tracks"
              >
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      filter === tab.id
                        ? "bg-white text-zinc-950"
                        : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {!hydrated ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-8">
                <div className="mx-auto h-2 max-w-xs animate-pulse rounded-full bg-white/10" />
                <div className="mx-auto h-2 max-w-sm animate-pulse rounded-full bg-white/5" />
                <div className="mx-auto h-2 max-w-[14rem] animate-pulse rounded-full bg-white/5" />
                <p className="pt-4 text-center text-sm text-zinc-500">Loading your studio…</p>
              </div>
            ) : filterEmpty ? (
              <div className="space-y-6">
                {libraryEmpty ? (
                  <div className="overflow-hidden rounded-2xl border border-dashed border-violet-500/25 bg-gradient-to-br from-violet-950/40 via-zinc-900/50 to-zinc-950/80 p-8 sm:p-10">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/15 text-violet-200">
                          <Inbox className="size-7" aria-hidden />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-white">
                            Library is empty
                          </h3>
                          <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                            Add your first track with the form on the left, or load demo
                            data to explore filters and checklists. Nothing is sent to a
                            server—everything stays in this browser.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => titleInputRef.current?.focus()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                      >
                        Start a track
                        <ArrowRight className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={loadDemoTracks}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                      >
                        <LayoutGrid className="size-4" aria-hidden />
                        Load demo tracks
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSampleLayout((v) => !v)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
                      >
                        <Camera className="size-4" aria-hidden />
                        {showSampleLayout ? "Hide sample layout" : "Show sample layout"}
                      </button>
                    </div>
                    <p className="mt-6 text-xs text-zinc-500">
                      Tip: append{" "}
                      <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-zinc-300">
                        ?screenshot=1
                      </code>{" "}
                      to auto-open the sample block for captures.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-500/25 bg-amber-950/20 p-8 sm:p-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-200">
                          <Filter className="size-7" aria-hidden />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-white">
                            No tracks match “{filterTabs.find((x) => x.id === filter)?.label}”
                          </h3>
                          <p className="max-w-lg text-sm leading-relaxed text-zinc-400">
                            Try another filter, or use the sample layout below for a
                            polished marketing capture without changing your data.
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <button
                          type="button"
                          onClick={() => setFilter("all")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                        >
                          Show all tracks
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSampleLayout((v) => !v)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
                        >
                          <Camera className="size-4" aria-hidden />
                          {showSampleLayout ? "Hide sample layout" : "Show sample layout"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {showSampleLayout ? (
                  <SampleDashboardPreview onDismiss={() => setShowSampleLayout(false)} />
                ) : null}
              </div>
            ) : (
              <ul className="space-y-4">
                {filtered.map((track) => (
                  <li key={track.id}>
                    <article className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 shadow-lg shadow-black/30 backdrop-blur transition hover:border-white/15">
                      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <h3 className="truncate text-lg font-semibold text-white">
                              {track.title}
                            </h3>
                            <StatusPill status={track.status} />
                            <PriorityPill priority={track.priority} />
                          </div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                            <div>
                              <dt className="text-zinc-500">BPM</dt>
                              <dd className="font-mono text-zinc-200">{track.bpm}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Key</dt>
                              <dd className="text-zinc-200">{track.key || "—"}</dd>
                            </div>
                            <div className="col-span-2 sm:col-span-2">
                              <dt className="text-zinc-500">Genre</dt>
                              <dd className="truncate text-zinc-200">
                                {track.genre || "—"}
                              </dd>
                            </div>
                          </dl>
                          {track.nextStep ? (
                            <p className="text-sm text-zinc-300">
                              <span className="font-medium text-violet-300">Next: </span>
                              {track.nextStep}
                            </p>
                          ) : null}
                          {track.notes ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">
                              {track.notes}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                          <label className="text-xs font-medium text-zinc-500">
                            Status
                            <select
                              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-sm text-white sm:w-40"
                              value={track.status}
                              onChange={(e) =>
                                updateTrack(track.id, {
                                  status: e.target.value as Status,
                                })
                              }
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs font-medium text-zinc-500">
                            Priority
                            <select
                              className="mt-1 block w-full rounded-lg border border-white/10 bg-zinc-950 px-2 py-2 text-sm text-white sm:w-40"
                              value={track.priority}
                              onChange={(e) =>
                                updateTrack(track.id, {
                                  priority: e.target.value as Priority,
                                })
                              }
                            >
                              {PRIORITIES.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => deleteTrack(track.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-white/10 bg-black/20 px-5 py-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Release checklist
                        </p>
                        <ul className="space-y-2">
                          {track.checklist.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => toggleChecklist(track.id, item.id)}
                                className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-300 transition hover:bg-white/5"
                              >
                                {item.done ? (
                                  <CheckCircle2
                                    className="mt-0.5 size-4 shrink-0 text-emerald-400"
                                    aria-hidden
                                  />
                                ) : (
                                  <Circle
                                    className="mt-0.5 size-4 shrink-0 text-zinc-600"
                                    aria-hidden
                                  />
                                )}
                                <span
                                  className={
                                    item.done ? "text-zinc-500 line-through" : ""
                                  }
                                >
                                  {item.label}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SampleDashboardPreview({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-zinc-900/60 shadow-2xl shadow-violet-950/20">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,0.08),transparent_45%,rgba(236,72,153,0.06))]" />
      <div className="relative flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-300/90">
          <Camera className="size-4" aria-hidden />
          Sample layout
          <span className="font-normal normal-case text-zinc-500">
            — not saved · for screenshots
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="pointer-events-auto rounded-lg border border-white/10 bg-zinc-950/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Dismiss
        </button>
      </div>

      <div
        className="pointer-events-none select-none space-y-6 p-5 opacity-[0.97] sm:p-6"
        aria-hidden
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total tracks"
            value={8}
            icon={Music2}
            accent="from-violet-500/30 to-transparent"
          />
          <StatCard
            label="Mixing"
            value={2}
            icon={Waves}
            accent="from-cyan-500/25 to-transparent"
          />
          <StatCard
            label="Ready"
            value={3}
            icon={Headphones}
            accent="from-emerald-500/25 to-transparent"
          />
          <StatCard
            label="Released"
            value={1}
            icon={Activity}
            accent="from-fuchsia-500/25 to-transparent"
          />
        </div>

        <ul className="space-y-4">
          {SAMPLE_DASHBOARD_ROWS.map((row) => (
            <li key={row.title}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-lg shadow-black/25">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <h3 className="truncate text-lg font-semibold text-white">
                        {row.title}
                      </h3>
                      <StatusPill status={row.status} />
                      <PriorityPill priority={row.priority} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-zinc-500">BPM</dt>
                        <dd className="font-mono text-zinc-200">{row.bpm}</dd>
                      </div>
                      <div>
                        <dt className="text-zinc-500">Key</dt>
                        <dd className="text-zinc-200">{row.key}</dd>
                      </div>
                      <div className="col-span-2 sm:col-span-2">
                        <dt className="text-zinc-500">Genre</dt>
                        <dd className="truncate text-zinc-200">{row.genre}</dd>
                      </div>
                    </dl>
                    <p className="text-sm text-zinc-300">
                      <span className="font-medium text-violet-300">Next: </span>
                      {row.nextStep}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                    <div className="h-9 w-full rounded-lg border border-white/10 bg-zinc-900/80 sm:w-36" />
                    <div className="h-9 w-full rounded-lg border border-white/10 bg-zinc-900/80 sm:w-36" />
                  </div>
                </div>
                <div className="border-t border-white/10 bg-black/25 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Release checklist
                  </p>
                  <ul className="space-y-2">
                    {row.checklistPreview.map((item) => (
                      <li
                        key={item.label}
                        className="flex items-start gap-3 text-sm text-zinc-300"
                      >
                        {item.done ? (
                          <CheckCircle2
                            className="mt-0.5 size-4 shrink-0 text-emerald-400"
                            aria-hidden
                          />
                        ) : (
                          <Circle
                            className="mt-0.5 size-4 shrink-0 text-zinc-600"
                            aria-hidden
                          />
                        )}
                        <span className={item.done ? "text-zinc-500 line-through" : ""}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">
        {label}
        {required ? <span className="text-fuchsia-400"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accent: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${accent} bg-zinc-900/50 p-5 backdrop-blur`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-zinc-300">
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const colors: Record<Status, string> = {
    Idea: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    Arrangement: "bg-sky-500/15 text-sky-200 border-sky-500/25",
    Mixing: "bg-cyan-500/15 text-cyan-200 border-cyan-500/25",
    Mastering: "bg-amber-500/15 text-amber-200 border-amber-500/25",
    Ready: "bg-emerald-500/15 text-emerald-200 border-emerald-500/25",
    Released: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/25",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[status]}`}
    >
      {status}
    </span>
  );
}

function PriorityPill({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = {
    Low: "border-white/10 bg-white/5 text-zinc-400",
    Medium: "border-violet-500/25 bg-violet-500/10 text-violet-200",
    High: "border-rose-500/35 bg-rose-500/15 text-rose-200",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[priority]}`}
    >
      {priority}
    </span>
  );
}
