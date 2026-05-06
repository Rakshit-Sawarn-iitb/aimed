import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mic, Brain, ShieldCheck, Languages, Share2, Activity,
  AlertTriangle, FileText, Stethoscope, Lock, ArrowRight,
  PlayCircle, FileSearch, Users, Heart,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.15 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return ref;
}

interface SectionProps { children: React.ReactNode; id?: string; className?: string }
function Section({ children, id, className = '' }: SectionProps) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id={id} className={`reveal ${className}`} ref={ref}>
      {children}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Top nav                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
      scrolled ? 'glass shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-md bg-primary/20 blur-md group-hover:bg-primary/40 transition-colors" />
            <img src="/aimed-logo.jpeg" alt="AIMED Logo" className="relative h-8 w-8 rounded-md object-cover" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">AIMED</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#problem"      className="hover:text-foreground transition-colors">Problem</a>
          <a href="#solution"     className="hover:text-foreground transition-colors">Solution</a>
          <a href="#architecture" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#ethics"       className="hover:text-foreground transition-colors">Ethics</a>
        </nav>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:shadow-primary/20"
        >
          Open the app <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Hero                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Animated background blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 -right-24 h-[28rem] w-[28rem] rounded-full bg-emerald-300/30 blur-3xl animate-blob anim-delay-1000" />
        <div className="absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-200/20 blur-3xl animate-blob anim-delay-500" />
      </div>

      {/* Grid backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-grid bg-grid-fade" />

      <div className="max-w-7xl w-full mx-auto px-6 grid md:grid-cols-12 gap-12 items-center">

        {/* Left: copy */}
        <div className="md:col-span-7 space-y-7 text-center md:text-left">
          <h1 className="font-display font-bold text-5xl md:text-7xl leading-[1.1] tracking-tight animate-fade-up">
            <span className="block">The doctor</span>
            <span className="block">writes nothing.</span>
            <span className="block text-gradient-teal italic pb-2 pr-2">The patient owns everything.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl animate-fade-up anim-delay-200">
            AIMED records a doctor-patient consultation in <em className="text-foreground not-italic">Hindi-English code-mix</em>,
            transcribes it with speaker diarization, and lets Claude extract a structured medical record —
            then forces the doctor to verify every high-risk fact, with the source audio one tap away.
          </p>

          <div className="flex flex-wrap gap-3 justify-center md:justify-start animate-fade-up anim-delay-300">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 h-12 px-6 rounded-full bg-foreground text-background font-medium hover:scale-[1.02] transition-all shadow-lg shadow-primary/10"
            >
              <span>Try the demo</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#solution"
              className="inline-flex items-center gap-2 h-12 px-6 rounded-full border border-border bg-card font-medium hover:bg-secondary transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              See how it works
            </a>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-6 pt-8 max-w-2xl animate-fade-up anim-delay-400">
            <Stat n="30%" label="of consult time spent on SOAP notes" />
            <Stat n="0"   label="AI diagnoses or prescriptions" />
            <Stat n="3"   label="taps for the patient to share their record" />
          </div>
        </div>

        {/* Right: floating record card */}
        <div className="md:col-span-5 animate-fade-up anim-delay-500">
          <DemoCard />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-muted-foreground text-xs flex flex-col items-center gap-1 animate-float">
        <span className="font-mono uppercase tracking-widest">Scroll</span>
        <div className="h-8 w-px bg-gradient-to-b from-muted-foreground to-transparent" />
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="text-left">
      <div className="font-display text-3xl md:text-4xl font-bold text-foreground">{n}</div>
      <div className="text-xs text-muted-foreground leading-snug mt-1">{label}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Demo card (the floating preview in the hero)                            */
/* ──────────────────────────────────────────────────────────────────────── */

function DemoCard() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 via-emerald-300/30 to-transparent blur-2xl rounded-3xl" />

      <div className="relative glass rounded-2xl p-6 shadow-xl shadow-primary/10">
        {/* Recording header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-danger animate-pulse-ring" />
              <span className="relative h-3 w-3 rounded-full bg-danger block" />
            </div>
            <span className="text-xs font-mono uppercase tracking-widest text-danger">Recording</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">02:14</span>
        </div>

        {/* Waveform */}
        <div className="mt-6 flex items-center justify-center gap-1 h-20">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="w-1.5 rounded-full bg-primary/70 animate-waveform"
              style={{
                animationDelay:  `${(i % 8) * 0.08}s`,
                animationDuration: `${0.6 + (i % 4) * 0.15}s`,
                height: `${10 + ((i * 7) % 40)}px`,
              }}
            />
          ))}
        </div>

        {/* Live transcript */}
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono uppercase text-primary mt-0.5">DR</span>
            <p className="text-foreground/90">Aap ko kya problem hai? Kab se hai bukhar?</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono uppercase text-emerald-700 mt-0.5">PT</span>
            <p className="text-foreground/90">
              Doctor saab, teen din se bukhar aa raha hai aur gala bhi <span className="bg-yellow-200/60 px-1 rounded">kharab</span> hai.
            </p>
          </div>
          <div className="flex items-start gap-2 opacity-60">
            <span className="text-[10px] font-mono uppercase text-primary mt-0.5">DR</span>
            <p className="text-foreground/90">Koi dawai chal rahi hai? Allergy?</p>
          </div>
        </div>

        {/* Extracted fact preview */}
        <div className="mt-5 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary">Extracted fact</span>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-tier3-bg text-tier3-text border border-tier3-border">
              TIER 3 · MEDICATION
            </span>
          </div>
          <p className="text-sm font-medium">Amoxicillin 500 mg, three times a day, 5 days</p>
          <p className="text-xs text-muted-foreground italic mt-1">
            "amoxicillin likh rahi hoon, 500mg, din mein teen baar"
          </p>
          <button className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
            <PlayCircle className="h-3.5 w-3.5" /> Play source audio (0:45–0:52)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Problem                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <Section id="problem" className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">The problem</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            Indian medicine has a memory problem —{' '}
            <span className="italic text-muted-foreground">and AI scribes are making it worse.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <ProblemCard
            icon={<FileSearch className="h-5 w-5" />}
            title="Records live nowhere."
            body="Asha sees three doctors over two years for the same complaint. Each visit she repeats her history from memory. Treatment plans contradict. Details get lost in drawer-bound prescriptions."
          />
          <ProblemCard
            icon={<Stethoscope className="h-5 w-5" />}
            title="Doctors skip the notes."
            body="Dr. Verma sees 50 patients a day. SOAP notes eat 30% of consult time. So she skips them — then reconstructs history from memory on the next visit, and prescription errors creep in."
          />
          <ProblemCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Existing scribes rubber-stamp."
            body="Most AI scribes are built for English-speaking US contexts. Indian code-mix breaks them. When they do work, doctors bulk-approve outputs they never read — turning AI hallucinations into prescriptions."
          />
        </div>

        {/* Real-world pull-quote */}
        <div className="mt-16 max-w-3xl mx-auto">
          <blockquote className="relative pl-8 border-l-4 border-primary/30">
            <div className="absolute -left-3 top-0 text-6xl font-display text-primary/30 leading-none">"</div>
            <p className="font-display italic text-2xl md:text-3xl leading-snug text-foreground/90">
              I told the last doctor about my penicillin allergy three times. The new one wrote
              an antibiotic anyway. He said it wasn't in the file.
            </p>
            <footer className="mt-4 text-sm text-muted-foreground">— Asha, OPD patient, Mumbai</footer>
          </blockquote>
        </div>
      </div>
    </Section>
  );
}

function ProblemCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group relative bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Solution                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

function SolutionSection() {
  const items = [
    {
      icon: <Mic className="h-5 w-5" />,
      label: 'Record',
      title: 'In-browser, code-mix friendly.',
      body: 'No native app. MediaRecorder captures the consult in Hindi-English. Sarvam Saaras v3 transcribes with speaker diarization in seconds.',
    },
    {
      icon: <Brain className="h-5 w-5" />,
      label: 'Extract',
      title: 'Claude reads the room — only what was said.',
      body: 'Claude Sonnet 4.6 with tool-use enforces a strict schema. Every fact carries a literal evidence quote and source utterance indices. The AI does not diagnose. Ever.',
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      label: 'Verify',
      title: 'The doctor cannot rubber-stamp.',
      body: 'Tier-1 facts bulk-approve. Tier-2 individually. Tier-3 (medications, allergies, diagnoses) require a tap — and the audio anchor must be played, server-side enforced, server-side audited.',
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      label: 'Own',
      title: 'The record belongs to the patient.',
      body: 'Asha sees what the doctor reviewed vs bulk-approved. She flags what she did not say. She generates time-limited, OTP-gated share links to the next doctor. Her data, her choice.',
    },
  ];

  return (
    <Section id="solution" className="relative py-24 md:py-32 px-6 bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-16 text-center mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">The solution</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            An audit-grade scribe that{' '}
            <span className="text-gradient-teal italic pb-1 pr-2 inline-block">refuses to make decisions for you.</span>
          </h2>
          <p className="text-lg text-muted-foreground mt-6">
            AIMED extracts what was <em className="text-foreground not-italic">said in the room</em>.
            It does not recommend, prescribe, or diagnose. That is the legal and ethical line —
            and the cleanest pitch we can give a judge or a patient.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {items.map((it, idx) => (
            <div key={it.label} className="group relative bg-card border border-border rounded-2xl p-7 hover:border-primary/40 transition-all overflow-hidden">
              <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/5 group-hover:bg-primary/10 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">0{idx + 1}</span>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    {it.icon}
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary">{it.label}</span>
                </div>
                <h3 className="font-display text-2xl font-semibold mb-3">{it.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{it.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Architecture                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function ArchitectureSection() {
  const steps = [
    { icon: <Mic     className="h-5 w-5" />, label: 'Browser',  sub: 'MediaRecorder',     color: 'from-primary to-emerald-500' },
    { icon: <Activity className="h-5 w-5" />, label: 'FastAPI', sub: 'ffmpeg → 16 kHz',   color: 'from-emerald-500 to-teal-500' },
    { icon: <Languages className="h-5 w-5" />, label: 'Sarvam', sub: 'Saaras v3 diarized', color: 'from-teal-500 to-cyan-500' },
    { icon: <Brain   className="h-5 w-5" />, label: 'Claude',  sub: 'Sonnet 4.6 tool-use', color: 'from-cyan-500 to-emerald-400' },
    { icon: <Lock    className="h-5 w-5" />, label: 'Supabase',sub: 'RLS + Storage',      color: 'from-emerald-400 to-primary' },
  ];

  return (
    <Section id="architecture" className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">How it works</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            From spoken consult to{' '}
            <span className="italic">structured, auditable record</span> in under 90 seconds.
          </h2>
        </div>

        {/* Pipeline */}
        <div className="relative bg-card border border-border rounded-3xl p-8 md:p-12 overflow-hidden">
          <div aria-hidden className="absolute inset-0 bg-grid bg-grid-fade opacity-50" />

          <div className="relative flex flex-wrap md:flex-nowrap items-stretch gap-2 md:gap-3">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2 md:gap-3 flex-1 min-w-[140px]">
                <div className="flex-1 group relative bg-background border border-border rounded-2xl p-4 hover:border-primary/40 hover:-translate-y-1 transition-all">
                  <div className={`absolute inset-x-0 -top-px h-px bg-gradient-to-r ${s.color} opacity-50`} />
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                    {s.icon}
                  </div>
                  <div className="font-display text-base font-semibold">{s.label}</div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{s.sub}</div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
              </div>
            ))}
          </div>

          <div className="relative grid md:grid-cols-3 gap-4 mt-10">
            <ArchPoint title="Tool-use enforced schema"  body="Claude returns JSON we can trust. No parsing failure modes." />
            <ArchPoint title="Per-fact audio anchors"    body="▶ scrubs to the exact 5-sec utterance the fact came from." />
            <ArchPoint title="Append-only audit log"     body="Every approval, edit, and play is logged. Patient sees it too." />
          </div>
        </div>
      </div>
    </Section>
  );
}

function ArchPoint({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-background/60 border border-border rounded-xl p-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {title}
      </h4>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Verification spine — the showcase                                       */
/* ──────────────────────────────────────────────────────────────────────── */

function VerificationSpine() {
  const tiers = [
    { tier: 1, label: 'Informational',    color: 'tier1', desc: 'Symptoms, history, lifestyle. Bulk-approve allowed.' },
    { tier: 2, label: 'Consequential',    color: 'tier2', desc: 'Vitals, exam findings, follow-up. One-tap each.' },
    { tier: 3, label: 'High-risk',        color: 'tier3', desc: 'Medications, allergies, diagnoses. Audio anchor required.' },
  ];

  return (
    <Section className="py-24 md:py-32 px-6 bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">The verification spine</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            Three tiers. <em className="italic">One unforgiving rule.</em>
          </h2>
          <p className="text-muted-foreground mt-6 leading-relaxed">
            We meet doctors where they are — overworked, under time pressure — without letting them
            cut corners on the things that hurt patients. Tier-3 facts cannot be bulk-approved.
            The button is disabled until the audio anchor has been played, and the server logs which path was taken.
          </p>

          <div className="mt-8 space-y-2">
            {tiers.map(t => (
              <div key={t.tier} className={`flex items-start gap-3 p-3 rounded-lg bg-${t.color}-bg border border-${t.color}-border`}>
                <span className={`text-${t.color}-text font-bold font-mono text-sm shrink-0 mt-0.5`}>T{t.tier}</span>
                <div>
                  <div className={`text-${t.color}-text text-sm font-semibold`}>{t.label}</div>
                  <div className={`text-${t.color}-text/80 text-xs mt-0.5`}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Animated mock fact card */}
        <div className="relative">
          <div className="absolute -inset-6 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-2xl rounded-3xl" />
          <div className="relative bg-card border border-border rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Medication</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-tier3-bg text-tier3-text border border-tier3-border">
                TIER 3 · HIGH RISK
              </span>
            </div>
            <div className="font-display text-xl font-semibold">Amoxicillin · 500 mg · TID · 5 days</div>
            <p className="text-sm text-muted-foreground italic mt-2">
              "amoxicillin likh rahi hoon, 500mg, din mein teen baar, paanch din ke liye"
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-muted">
                <PlayCircle className="h-3.5 w-3.5 text-primary" /> 0:45–0:52
              </button>
              <span className="text-success font-medium flex items-center gap-1">✓ played</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Approve
              </button>
              <button className="h-10 px-4 rounded-md border border-border text-sm font-medium hover:bg-secondary">
                Edit
              </button>
              <button className="h-10 px-4 rounded-md border border-border text-sm font-medium hover:bg-secondary text-destructive">
                Reject
              </button>
            </div>
            <div className="mt-3 text-[10px] font-mono text-muted-foreground">
              audit · audio_played=true · individually_reviewed=true
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Ethics                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

function EthicsSection() {
  const points = [
    { icon: <Heart   />, title: 'Patient owns the record.',     body: 'No clinic walls. No vendor lock-in. Asha generates time-limited share links and watches who opens them.' },
    { icon: <FileText/>, title: 'Every claim is citable.',      body: 'Each fact carries a literal evidence quote and source utterance indices. The server validates the quote is a real substring before insert.' },
    { icon: <Users   />, title: 'Patient can dispute.',          body: 'Non-blocking flags ride along with the record. The next doctor sees what Asha disagreed with — without a draft state machine.' },
    { icon: <ShieldCheck/>, title: 'Lazy review is visible.',    body: 'Audit summary tells the patient: "your doctor played audio for 4 of 8 high-risk facts." Trust pressure flows back to the doctor.' },
  ];
  return (
    <Section id="ethics" className="py-24 md:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-16">
          <p className="text-xs font-mono uppercase tracking-widest text-primary mb-3">Ethical alignment</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            Receipts, not promises.
          </h2>
          <p className="text-lg text-muted-foreground mt-6">
            Every claim AIMED makes about the consult is auditable, every doctor action is logged,
            every patient has a kill-switch. The ethics aren't bolted on — they're how the system fails closed.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {points.map(p => (
            <div key={p.title} className="flex items-start gap-4 bg-card border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {p.icon}
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  CTA + Footer                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <Section className="py-24 px-6">
      <div className="max-w-4xl mx-auto relative">
        <div aria-hidden className="absolute -inset-6 bg-gradient-to-tr from-primary/30 via-emerald-300/30 to-transparent blur-3xl rounded-3xl" />
        <div className="relative bg-foreground text-background rounded-3xl p-10 md:p-16 text-center overflow-hidden">
          <div aria-hidden className="absolute inset-0 bg-grid opacity-10" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
              Try it on a 60-second consult.
            </h2>
            <p className="mt-4 text-background/70 max-w-xl mx-auto">
              Phone OTP · doctor or patient · works from any browser. Built for the hackathon —
              opinionated, audit-grade, deliberately narrow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-primary text-primary-foreground font-medium hover:scale-[1.02] transition-transform"
              >
                Open the app <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/Rakshit-Sawarn-iitb/aimed"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 h-12 px-7 rounded-full border border-background/30 hover:bg-background/10 font-medium transition-colors"
              >
                View source
              </a>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src="/aimed-logo.jpeg" alt="AIMED Logo" className="h-6 w-6 rounded-md object-cover" />
          <span className="font-display font-semibold">AIMED</span>
        </div>
        <div className="text-xs flex items-center gap-1.5">
          Built with <span className="text-red-500" aria-label="love">❤</span>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Page                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <TopNav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <ArchitectureSection />
        <VerificationSpine />
        <EthicsSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
