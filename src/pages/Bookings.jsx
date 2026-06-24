import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Save,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/lib/format';

const STATUS_OPTIONS = [
  { value: 'booked', label: 'Booked' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES = {
  booked: 'border-blue-500/30 bg-blue-950/20 text-blue-300',
  confirmed: 'border-gold-600/30 bg-gold-600/10 text-gold-300',
  in_progress: 'border-amber-500/30 bg-amber-950/30 text-amber-300',
  ready: 'border-green-500/30 bg-green-950/20 text-green-300',
  delivered: 'border-luxury-border bg-luxury-slate text-luxury-muted',
  cancelled: 'border-red-500/30 bg-red-950/20 text-red-300',
};

const emptyForm = {
  customer_name: '',
  customer_phone: '',
  car_model: '',
  car_plate: '',
  service_summary: '',
  scheduled_at: '',
  duration_minutes: 120,
  status: 'booked',
  assigned_to: '',
  notes: '',
};

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function toDateTimeLocal(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function startOfLocalDay(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function endOfLocalDay(dateString) {
  return new Date(`${dateString}T23:59:59.999`);
}

export default function Bookings() {
  const { user, profile } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(todayInputDate());
  const [bookings, setBookings] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, scheduled_at: toDateTimeLocal() });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBookings();
  }, [selectedDate]);

  useEffect(() => {
    loadLookups();
  }, []);

  async function loadLookups() {
    const [profileRes, customerRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
      supabase
        .from('customers')
        .select('id, full_name, phone')
        .order('last_visit_at', { ascending: false, nullsFirst: false })
        .limit(100),
    ]);
    setProfiles(profileRes.data || []);
    setCustomers(customerRes.data || []);
  }

  async function loadBookings() {
    setLoading(true);
    setMessage('');
    const from = startOfLocalDay(selectedDate).toISOString();
    const to = endOfLocalDay(selectedDate).toISOString();

    const { data, error } = await supabase
      .from('bookings')
      .select('*, assigned_profile:profiles!bookings_assigned_to_fkey(full_name, role)')
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at');

    if (error) {
      setMessage(
        error.code === 'PGRST205'
          ? 'Bookings table is missing. Run supabase/migrations/008_bookings.sql.'
          : error.message
      );
      setBookings([]);
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      scheduled_at: `${selectedDate}T09:00`,
      assigned_to: user?.id || '',
    });
    setShowForm(true);
    setMessage('');
  }

  function openEdit(booking) {
    setEditingId(booking.id);
    setForm({
      customer_name: booking.customer_name || '',
      customer_phone: booking.customer_phone || '',
      car_model: booking.car_model || '',
      car_plate: booking.car_plate || '',
      service_summary: booking.service_summary || '',
      scheduled_at: toDateTimeLocal(new Date(booking.scheduled_at)),
      duration_minutes: booking.duration_minutes || 120,
      status: booking.status || 'booked',
      assigned_to: booking.assigned_to || '',
      notes: booking.notes || '',
    });
    setShowForm(true);
    setMessage('');
  }

  function closeForm() {
    setEditingId(null);
    setShowForm(false);
    setForm({ ...emptyForm, scheduled_at: toDateTimeLocal() });
  }

  function applyCustomer(customerId) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setForm((current) => ({
      ...current,
      customer_name: customer.full_name || current.customer_name,
      customer_phone: customer.phone || current.customer_phone,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const name = form.customer_name.trim();
    const serviceSummary = form.service_summary.trim();
    if (!name) {
      setMessage('Customer name is required.');
      return;
    }
    if (!serviceSummary) {
      setMessage('Service summary is required.');
      return;
    }

    setSaving(true);
    setMessage('');

    const payload = {
      customer_name: name,
      customer_phone: form.customer_phone.trim() || null,
      car_model: form.car_model.trim() || null,
      car_plate: form.car_plate.trim() || null,
      service_summary: serviceSummary,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: Math.max(15, Number(form.duration_minutes) || 120),
      status: form.status,
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from('bookings').update(payload).eq('id', editingId)
      : await supabase.from('bookings').insert({ ...payload, created_by: user?.id || null });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(editingId ? 'Booking updated.' : 'Booking created.');
    closeForm();
    loadBookings();
  }

  async function updateStatus(booking, status) {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', booking.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadBookings();
  }

  function moveDay(amount) {
    const date = startOfLocalDay(selectedDate);
    date.setDate(date.getDate() + amount);
    setSelectedDate(toDateInput(date));
  }

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter((booking) =>
      [
        booking.customer_name,
        booking.customer_phone,
        booking.car_model,
        booking.car_plate,
        booking.service_summary,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q))
    );
  }, [bookings, search]);

  const statusCounts = useMemo(() => {
    return STATUS_OPTIONS.reduce((counts, option) => {
      counts[option.value] = bookings.filter((booking) => booking.status === option.value).length;
      return counts;
    }, {});
  }, [bookings]);

  const activeCount = bookings.filter(
    (booking) => !['delivered', 'cancelled'].includes(booking.status)
  ).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-500 mb-1">Schedule</p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-gold-400 flex items-center gap-3">
            <CalendarClock className="text-gold-500" />
            Bookings
          </h1>
          <p className="text-luxury-muted mt-1 text-sm sm:text-base">
            Schedule detailing, tint, PPF, and coating jobs before they become invoices.
          </p>
        </div>
        {!showForm && (
          <button type="button" onClick={openNew} className="btn-gold inline-flex items-center gap-2">
            <Plus size={18} />
            New Booking
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-luxury">
          <p className="text-sm text-luxury-muted">Selected Day</p>
          <p className="text-xl font-bold text-gold-400 mt-1">
            {startOfLocalDay(selectedDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="card-luxury">
          <p className="text-sm text-luxury-muted">Active Jobs</p>
          <p className="text-xl font-bold text-gold-400 mt-1">{activeCount}</p>
        </div>
        <div className="card-luxury">
          <p className="text-sm text-luxury-muted">Ready for Delivery</p>
          <p className="text-xl font-bold text-gold-400 mt-1">{statusCounts.ready || 0}</p>
        </div>
      </div>

      <div className="card-luxury mb-6">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => moveDay(-1)} className="btn-outline px-3" aria-label="Previous day">
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              className="input-luxury max-w-[180px]"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayInputDate())}
            />
            <button type="button" onClick={() => moveDay(1)} className="btn-outline px-3" aria-label="Next day">
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => setSelectedDate(todayInputDate())} className="btn-outline text-sm">
              Today
            </button>
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-luxury-muted" size={18} />
            <input
              className="input-luxury pl-10"
              placeholder="Search customer, car, plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card-luxury mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gold-400">
              {editingId ? 'Edit Booking' : 'New Booking'}
            </h2>
            <button type="button" onClick={closeForm} className="text-luxury-muted hover:text-gold-300">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div>
              <label className="label-luxury">Use Existing Customer</label>
              <select className="input-luxury" defaultValue="" onChange={(e) => applyCustomer(e.target.value)}>
                <option value="">Select customer...</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name} {customer.phone ? `- ${customer.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">Customer Name</label>
              <input
                className="input-luxury"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label-luxury">Phone</label>
              <input
                className="input-luxury"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label-luxury">Assigned To</label>
              <select
                className="input-luxury"
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              >
                <option value="">Unassigned</option>
                {profiles.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.full_name || row.role || 'Team member'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">Car Model</label>
              <input
                className="input-luxury"
                value={form.car_model}
                onChange={(e) => setForm({ ...form, car_model: e.target.value })}
                placeholder="Range Rover, Land Cruiser..."
              />
            </div>
            <div>
              <label className="label-luxury">Plate</label>
              <input
                className="input-luxury"
                value={form.car_plate}
                onChange={(e) => setForm({ ...form, car_plate: e.target.value })}
              />
            </div>
            <div>
              <label className="label-luxury">Date and Time</label>
              <input
                type="datetime-local"
                className="input-luxury"
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label-luxury">Duration</label>
              <select
                className="input-luxury"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
                <option value="360">Full day</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label-luxury">Services Needed</label>
              <input
                className="input-luxury"
                value={form.service_summary}
                onChange={(e) => setForm({ ...form, service_summary: e.target.value })}
                placeholder="Full detailing, tint, PPF front bumper..."
                required
              />
            </div>
            <div>
              <label className="label-luxury">Status</label>
              <select
                className="input-luxury"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-luxury">Created By</label>
              <div className="input-luxury text-luxury-muted">
                {profile?.full_name || user?.email || 'Current user'}
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <label className="label-luxury">Notes</label>
              <textarea
                rows={3}
                className="input-luxury resize-none"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Customer requests, drop-off details, material preference..."
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <button type="submit" disabled={saving} className="btn-gold inline-flex items-center gap-2">
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Booking'}
            </button>
            <button type="button" onClick={closeForm} className="btn-outline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className={`mb-4 text-sm ${message.includes('created') || message.includes('updated') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 mb-6">
        {STATUS_OPTIONS.map((status) => (
          <div key={status.value} className={`rounded-lg border px-4 py-3 ${STATUS_STYLES[status.value]}`}>
            <p className="text-xs uppercase tracking-wide opacity-80">{status.label}</p>
            <p className="text-2xl font-bold mt-1">{statusCounts[status.value] || 0}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="card-luxury text-center text-luxury-muted">Loading bookings...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="card-luxury text-center text-luxury-muted">
            No bookings for this day. Create one when a customer reserves a slot.
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <article key={booking.id} className="card-luxury">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || STATUS_STYLES.booked}`}>
                      {STATUS_OPTIONS.find((option) => option.value === booking.status)?.label || booking.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm text-luxury-muted">
                      <Clock size={15} />
                      {formatDateTime(booking.scheduled_at)} ({booking.duration_minutes} min)
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-gold-400 truncate">{booking.customer_name}</h2>
                  <p className="text-luxury-muted mt-1">{booking.service_summary}</p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-luxury-muted">
                    {booking.customer_phone && <span>{booking.customer_phone}</span>}
                    {(booking.car_model || booking.car_plate) && (
                      <span>
                        {[booking.car_model, booking.car_plate].filter(Boolean).join(' - ')}
                      </span>
                    )}
                    {booking.assigned_profile?.full_name && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={15} />
                        {booking.assigned_profile.full_name}
                      </span>
                    )}
                  </div>
                  {booking.notes && (
                    <p className="mt-3 rounded-lg border border-luxury-border bg-luxury-slate/50 px-3 py-2 text-sm text-luxury-muted">
                      {booking.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <select
                    className="input-luxury min-w-[160px]"
                    value={booking.status}
                    onChange={(e) => updateStatus(booking, e.target.value)}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => openEdit(booking)} className="btn-outline inline-flex items-center gap-2">
                    <Pencil size={16} />
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
