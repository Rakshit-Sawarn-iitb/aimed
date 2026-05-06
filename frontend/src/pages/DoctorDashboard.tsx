import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, startOfWeek, addDays, addWeeks, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useMe, profileName } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ConsultListItem, ConsultStatus } from '@/types';

type FilterTab = 'all' | 'in_review' | 'finalized' | 'failed';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'in_review', label: 'Needs review' },
  { key: 'finalized', label: 'Finalized' },
  { key: 'failed',    label: 'Failed' },
];

const TILE_BORDER: Partial<Record<string, string>> = {
  in_review: 'border-l-4 border-l-warning',
  finalized: 'border-l-4 border-l-success',
  failed:    'border-l-4 border-l-danger',
};

const TODAY = new Date();

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { me } = useMe();
  const name = profileName(me);
  // Use the last word of the name to avoid "Dr. Dr." when profile stores "Dr. Firstname Lastname"
  const lastName = name ? name.split(' ').slice(-1)[0] : '';

  const [consults, setConsults] = useState<ConsultListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = current week, -1 = last week, etc.
  const [selectedDay, setSelectedDay] = useState(format(TODAY, 'yyyy-MM-dd'));

  useEffect(() => {
    api.get<ConsultListItem[]>('/consults')
      .then(setConsults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Week days (Mon → Sun) for the visible week
  const weekDays = useMemo(() => {
    const base = weekOffset === 0 ? TODAY : addWeeks(TODAY, weekOffset);
    const start = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  // consult count keyed by 'yyyy-MM-dd'
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of consults) {
      if (!c.created_at) continue;
      const key = format(parseISO(c.created_at), 'yyyy-MM-dd');
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [consults]);

  const dayFiltered = useMemo(
    () => consults.filter(c =>
      c.created_at
        ? format(parseISO(c.created_at), 'yyyy-MM-dd') === selectedDay
        : false
    ),
    [consults, selectedDay]
  );

  const filtered = useMemo(() => {
    if (tab === 'in_review') return dayFiltered.filter(c => c.status === 'in_review');
    if (tab === 'finalized') return dayFiltered.filter(c => c.status === 'finalized');
    if (tab === 'failed')    return dayFiltered.filter(c => c.status === 'failed');
    return dayFiltered;
  }, [dayFiltered, tab]);

  const count = (key: FilterTab) => {
    if (key === 'in_review') return dayFiltered.filter(c => c.status === 'in_review').length;
    if (key === 'finalized') return dayFiltered.filter(c => c.status === 'finalized').length;
    if (key === 'failed')    return dayFiltered.filter(c => c.status === 'failed').length;
    return dayFiltered.length;
  };

  const todayKey = format(TODAY, 'yyyy-MM-dd');

  // Label for the selected day in the list header
  const selectedDayLabel = useMemo(() => {
    const d = parseISO(selectedDay);
    if (isSameDay(d, TODAY)) return 'Today';
    return format(d, 'EEEE, MMM d');
  }, [selectedDay]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4 pb-20 md:pb-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1>{format(TODAY, 'EEEE, MMM d')}</h1>
            <p className="text-sm text-muted-foreground">
              {lastName ? `Welcome back, Dr. ${lastName}` : "Today's consults"}
            </p>
          </div>
          <Button className="min-h-[44px] gap-2" onClick={() => navigate('/doctor/consult/new')}>
            <Plus className="h-4 w-4" />
            New consult
          </Button>
        </div>

        {/* Week calendar strip */}
        <div className="bg-card border border-border rounded-xl p-3">
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {weekOffset !== 0 && (
                <button
                  onClick={() => { setWeekOffset(0); setSelectedDay(todayKey); }}
                  className="text-[11px] font-medium text-primary px-2 hover:underline"
                >
                  Today
                </button>
              )}
              <button
                onClick={() => setWeekOffset(w => w + 1)}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                disabled={weekOffset >= 0}
              >
                <ChevronRight className={cn('h-3.5 w-3.5', weekOffset >= 0 && 'opacity-30')} />
              </button>
            </div>
          </div>

          {/* Day pills */}
          <div className="flex gap-1">
            {weekDays.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayCount = countByDay.get(key) || 0;
              const isSelected = key === selectedDay;
              const isToday = key === todayKey;
              const isFuture = day > TODAY;

              return (
                <button
                  key={key}
                  disabled={isFuture}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                      ? 'border border-primary/30 text-foreground hover:bg-muted'
                      : isFuture
                      ? 'opacity-30 cursor-default text-muted-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {format(day, 'EEE')}
                  </span>
                  <span className="text-sm font-bold leading-none mt-0.5">
                    {format(day, 'd')}
                  </span>
                  {/* Consult count dot */}
                  <div className="h-4 flex items-center justify-center mt-0.5">
                    {dayCount > 0 ? (
                      <span className={cn(
                        'text-[10px] font-semibold tabular-nums rounded-full min-w-[16px] h-4 flex items-center justify-center px-1',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      )}>
                        {dayCount}
                      </span>
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-current opacity-20" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        {!loading && dayFiltered.length > 0 && (
          <div className="flex gap-0 border-b border-border">
            {TABS.filter(t => t.key === 'all' || count(t.key) > 0).map(t => {
              const c = count(t.key);
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t.label}
                  {c > 0 && (
                    <span className={cn(
                      'ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {c}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Consult list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">
              {dayFiltered.length === 0
                ? `No consults on ${selectedDayLabel.toLowerCase()}.`
                : `No ${TABS.find(t => t.key === tab)?.label.toLowerCase()} consults.`}
            </p>
            {dayFiltered.length === 0 && isSameDay(parseISO(selectedDay), TODAY) && (
              <p className="text-xs text-muted-foreground mt-1">
                Tap "New consult" to record your first one today.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              {selectedDayLabel}
            </p>
            <div className="space-y-2">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/doctor/consult/${c.id}`, {
                    state: { patientName: c.patient_name },
                  })}
                  className={cn(
                    'w-full text-left bg-card border border-border rounded-lg px-4 py-3',
                    'hover:bg-secondary/50 transition-colors flex items-center justify-between gap-4',
                    TILE_BORDER[c.status]
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.patient_name ?? (
                        <span className="font-mono text-muted-foreground">
                          {c.patient_id.slice(0, 8)}…
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.created_at ? format(parseISO(c.created_at), 'h:mm a') : '—'}
                    </p>
                  </div>
                  <StatusBadge status={c.status as ConsultStatus} />
                </button>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
