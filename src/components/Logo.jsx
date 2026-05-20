export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { img: 'w-8 h-8', text: 'text-sm' },
    md: { img: 'w-12 h-12', text: 'text-lg' },
    lg: { img: 'w-16 h-16', text: 'text-2xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-3">
      <img src="/logo.svg" alt="Arizona Car World" className={s.img} />
      {showText && (
        <div className="hidden sm:block">
          <h1 className={`font-display text-gold-400 font-bold ${s.text}`}>
            Arizona Car World
          </h1>
          <p className="text-xs text-luxury-muted tracking-widest uppercase">
            Detailing · PPF · Tint
          </p>
        </div>
      )}
    </div>
  );
}
