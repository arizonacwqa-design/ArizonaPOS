export default function StatCard({ title, value, subtitle, icon: Icon, alert }) {
  return (
    <div
      className={`card-luxury relative overflow-hidden ${
        alert ? 'border-red-500/50' : ''
      }`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-gold-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-luxury-muted text-sm mb-1">{title}</p>
          <p className={`text-3xl font-bold ${alert ? 'text-red-400' : 'text-gold-400'}`}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-luxury-muted mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3 bg-gold-600/10 rounded-lg">
            <Icon className="text-gold-400" size={24} />
          </div>
        )}
      </div>
    </div>
  );
}
