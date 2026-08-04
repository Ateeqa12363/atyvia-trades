import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin } from 'lucide-react'
import { getQuoteForBooking, listJobSlots, bookJobSlot } from '@/lib/quote-respond.functions'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/q/$token/book')({
  head: () => ({
    meta: [
      { title: 'Book your job visit — Atyvia' },
      {
        name: 'description',
        content:
          'Pick a date and time for your tradesperson to carry out the work on your accepted quote.',
      },
      { property: 'og:title', content: 'Book your job visit — Atyvia' },
      {
        property: 'og:description',
        content: 'Choose a slot that suits you and we will confirm the visit.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: BookJobPage,
})

const fmtMoney = (n: number) =>
  `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function BookJobPage() {
  const { token } = Route.useParams()
  const [picked, setPicked] = useState<string | null>(null)
  const [done, setDone] = useState<{ date: string; time: string } | null>(null)

  const quoteQ = useQuery({
    queryKey: ['public-quote', token],
    queryFn: () => getQuoteForBooking({ data: { token } }),
    retry: false,
  })
  const slotsQ = useQuery({
    queryKey: ['public-slots', token],
    queryFn: () => listJobSlots({ data: { token } }),
    enabled: !!quoteQ.data,
    retry: false,
  })

  const book = useMutation({
    mutationFn: (start: string) => bookJobSlot({ data: { token, start } }),
    onSuccess: (r) => setDone({ date: r.scheduledDate, time: r.scheduledTime }),
    onError: () => slotsQ.refetch(),
  })

  const days = useMemo(() => {
    const slots = slotsQ.data?.slots ?? {}
    return Object.entries(slots).sort(([a], [b]) => a.localeCompare(b))
  }, [slotsQ.data])

  const existing = quoteQ.data?.scheduled

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-semibold">Quote accepted — thank you</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Pick a slot for the work</h1>

        {quoteQ.isLoading && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your quote…
          </p>
        )}

        {quoteQ.isError && (
          <p className="mt-4 text-sm text-destructive">
            We couldn't find this quote. Please reply to the email you received and we'll help.
          </p>
        )}

        {quoteQ.data && (
          <>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <div>
                {quoteQ.data.customerName ? `${quoteQ.data.customerName} — ` : ''}
                <span className="font-medium text-foreground">{fmtMoney(quoteQ.data.total)}</span>{' '}
                total
              </div>
              {quoteQ.data.address && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{quoteQ.data.address}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Approx. {Math.round((slotsQ.data?.durationMinutes ?? quoteQ.data.durationMinutes) / 60 * 10) / 10} hrs on site</span>
              </div>
            </div>

            {(done || (existing && !done)) && (
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                <div className="font-semibold text-emerald-700">Visit booked</div>
                <div className="mt-1 text-emerald-800/80">
                  {format(parseISO(done?.date ?? existing!.date), 'EEEE d MMMM yyyy')}
                  {(done?.time ?? existing?.time) ? ` at ${done?.time ?? existing?.time}` : ''}
                </div>
                <p className="mt-2 text-xs text-emerald-800/70">
                  We'll send a confirmation and be in touch if anything changes.
                </p>
              </div>
            )}

            {!done && !existing && (
              <div className="mt-6">
                {slotsQ.isLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
                  </p>
                )}
                {slotsQ.data && (!slotsQ.data.configured || days.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No online slots are available right now — we'll call you to arrange a time.
                  </p>
                )}
                {days.length > 0 && (
                  <div className="space-y-4">
                    {days.map(([day, times]) => (
                      <div key={day}>
                        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(parseISO(day), 'EEEE d MMMM')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {times.map((iso) => (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setPicked(iso)}
                              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                                picked === iso
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border hover:bg-muted'
                              }`}
                            >
                              {new Date(iso).toLocaleTimeString('en-GB', {
                                hour: '2-digit',
                                minute: '2-digit',
                                timeZone: 'Europe/London',
                              })}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {book.isError && (
                  <p className="mt-4 text-sm text-destructive">
                    {(book.error as Error)?.message ?? 'Could not book that slot.'}
                  </p>
                )}

                {days.length > 0 && (
                  <Button
                    className="mt-6 w-full"
                    disabled={!picked || book.isPending}
                    onClick={() => picked && book.mutate(picked)}
                  >
                    {book.isPending ? 'Booking…' : 'Confirm this slot'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
          Atyvia
        </p>
      </div>
    </main>
  )
}
