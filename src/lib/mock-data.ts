// Realistic sample data for Atyvia demo
export const brand = {
  clientName: "Whitfield Plumbing & Heating",
  clientPlan: "Pro",
};

// Simplified KPIs for tradespeople — the 4 numbers that matter
export const kpis = [
  { id: "answered", label: "Calls Answered", value: 1198, delta: 12.1, sublabel: "So you didn't miss the job", spark: [8, 12, 15, 18, 20, 24, 28, 30, 34, 36, 40, 44] },
  { id: "appts", label: "Jobs Booked", value: 342, delta: 27.8, sublabel: "Straight into your diary", spark: [10, 14, 18, 22, 24, 28, 30, 32, 34, 36, 38, 42] },
  { id: "revenue", label: "Extra Money Earned", value: 128400, prefix: "£", delta: 34.1, sublabel: "Work you'd have missed", spark: [40, 50, 62, 68, 74, 82, 90, 98, 106, 114, 120, 128] },
  { id: "saved", label: "Money Saved", value: 8420, prefix: "£", delta: 12.4, sublabel: "Receptionist £2,200/month\nAtyvia £577/month", spark: [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.4] },
];

export const revenueSeries = [
  { name: "Jan", generated: 68000, lost: 12000, recovered: 4200 },
  { name: "Feb", generated: 74000, lost: 10500, recovered: 5100 },
  { name: "Mar", generated: 82000, lost: 9800, recovered: 6300 },
  { name: "Apr", generated: 91000, lost: 8600, recovered: 7400 },
  { name: "May", generated: 98000, lost: 7900, recovered: 8100 },
  { name: "Jun", generated: 104000, lost: 7200, recovered: 8900 },
  { name: "Jul", generated: 112000, lost: 6800, recovered: 9700 },
  { name: "Aug", generated: 118000, lost: 6100, recovered: 10400 },
  { name: "Sep", generated: 124000, lost: 5800, recovered: 11200 },
  { name: "Oct", generated: 128400, lost: 5200, recovered: 12100 },
];

export const callsByHour = Array.from({ length: 24 }, (_, h) => {
  const peak = h >= 9 && h <= 17 ? 1 : 0.35;
  const noon = 1 - Math.abs(h - 13) / 14;
  return { hour: `${h}:00`, calls: Math.round((20 + noon * 60) * peak + Math.random() * 8) };
});

export const callsByWeekday = [
  { day: "Mon", calls: 232, appts: 68 },
  { day: "Tue", calls: 218, appts: 62 },
  { day: "Wed", calls: 201, appts: 58 },
  { day: "Thu", calls: 194, appts: 54 },
  { day: "Fri", calls: 178, appts: 48 },
  { day: "Sat", calls: 142, appts: 34 },
  { day: "Sun", calls: 109, appts: 18 },
];

export const callReasons = [
  { name: "Book appointment", value: 42, color: "var(--color-chart-1)" },
  { name: "Pricing enquiry", value: 21, color: "var(--color-chart-2)" },
  { name: "Reschedule", value: 14, color: "var(--color-chart-3)" },
  { name: "Service info", value: 12, color: "var(--color-chart-4)" },
  { name: "Other", value: 11, color: "var(--color-chart-5)" },
];

export const aiPerformance = [
  { metric: "Booking Rate", value: 68 },
  { metric: "Qualification Rate", value: 82 },
  { metric: "Knowledge Accuracy", value: 96 },
  { metric: "Transfer Success", value: 91 },
  { metric: "Sentiment Positive", value: 88 },
  { metric: "Conversation Score", value: 94 },
];

export const pipeline = [
  { stage: "New Leads", count: 487, value: 487 },
  { stage: "Qualified", count: 342, value: 342 },
  { stage: "Appointment", count: 268, value: 268 },
  { stage: "Proposal Sent", count: 184, value: 184 },
  { stage: "Won", count: 128, value: 128 },
  { stage: "Lost", count: 56, value: 56 },
];

export const liveFeedSeed = [
  { type: "answered", text: "Call answered · boiler not firing", meta: "+44 7700 900123", time: "2s ago" },
  { type: "appt", text: "Job booked · Boiler service · Fri 3:00pm", meta: "James Whitmore", time: "18s ago" },
  { type: "lead", text: "New enquiry · Bathroom refit", meta: "£4,200 est. value", time: "44s ago" },
  { type: "answered", text: "Call answered · price for tap replacement", meta: "+44 7700 900184", time: "1m ago" },
  { type: "transfer", text: "Passed to you · urgent leak", meta: "Callback in 10 min", time: "2m ago" },
  { type: "spam", text: "Spam call blocked", meta: "Auto-filtered", time: "3m ago" },
  { type: "voicemail", text: "Message taken · quote request", meta: "Details in inbox", time: "4m ago" },
  { type: "missed", text: "After-hours call · callback booked", meta: "+44 7700 900412", time: "5m ago" },
];

export const feedActionPool = [
  { type: "answered", text: "Call answered · new customer", meta: () => `+44 7700 900${Math.floor(Math.random() * 900 + 100)}` },
  { type: "appt", text: "Job booked · Callout", meta: () => "Confirmed via text" },
  { type: "lead", text: "New enquiry · Heating install", meta: () => `£${(1200 + Math.random() * 3000).toFixed(0)} est. value` },
  { type: "answered", text: "Call answered · booking a slot", meta: () => "Slot confirmed" },
  { type: "spam", text: "Spam call blocked", meta: () => "Auto-filtered" },
  { type: "voicemail", text: "Message taken", meta: () => "In your inbox" },
];

export const insights = [
  {
    kind: "growth",
    title: "Appointment bookings up 27% this month",
    body: "Booking momentum accelerated after 6pm coverage extended. Highest gains from returning patients.",
  },
  {
    kind: "opportunity",
    title: "Pricing enquiries jumped 41% this week",
    body: "Consider publishing an updated price guide — patients are asking about Invisalign most frequently.",
  },
  {
    kind: "warning",
    title: "Missed calls concentrate after 5pm",
    body: "Extending AI coverage to 9pm could recover an estimated £4,500 in monthly revenue.",
  },
  {
    kind: "growth",
    title: "Weekend demand growing 3× faster than weekdays",
    body: "Opening Saturday morning slots could convert 22 additional appointments per month.",
  },
];

export const upcomingAppointments = [
  { name: "Olivia Bennett", service: "Consultation", time: "Today 14:30", status: "confirmed" },
  { name: "Marcus Chen", service: "Cleaning", time: "Today 15:15", status: "confirmed" },
  { name: "Priya Shah", service: "Invisalign fitting", time: "Today 16:00", status: "pending" },
  { name: "David Osei", service: "Emergency", time: "Tomorrow 09:00", status: "confirmed" },
  { name: "Isabelle Fournier", service: "Whitening", time: "Tomorrow 11:30", status: "confirmed" },
];

export const healthScore = {
  score: 92,
  factors: [
    { name: "Response Speed", value: 96 },
    { name: "Pickup Rate", value: 94 },
    { name: "Lead Conversion", value: 88 },
    { name: "Appointment Rate", value: 91 },
    { name: "Satisfaction", value: 96 },
    { name: "Revenue Trend", value: 89 },
  ],
  recommendations: [
    "Increase staffing on Mondays — call volume peaks 22% above average.",
    "Enable SMS appointment reminders to cut no-shows by an estimated 14%.",
    "Improve follow-up speed on qualified leads to under 2 hours.",
    "Offer Saturday morning slots to capture weekend demand.",
  ],
};

export const integrations = [
  { name: "Google Calendar", status: "connected", category: "Calendar" },
  { name: "Microsoft Outlook", status: "connected", category: "Calendar" },
  { name: "HubSpot", status: "connected", category: "CRM" },
  { name: "Salesforce", status: "available", category: "CRM" },
  { name: "GoHighLevel", status: "connected", category: "CRM" },
  { name: "Retell AI", status: "connected", category: "Voice" },
  { name: "Twilio", status: "connected", category: "Voice" },
  { name: "Stripe", status: "connected", category: "Payments" },
  { name: "Zapier", status: "available", category: "Automation" },
  { name: "Make", status: "available", category: "Automation" },
];
