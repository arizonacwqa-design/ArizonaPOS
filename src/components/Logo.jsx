export default function Logo({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    xl: 'w-28 h-28',
  };
  return (
    <img
      src="/logo.png"
      alt="Arizona Car World"
      className={`${sizes[size] || sizes.md} object-contain ${className}`}
    />
  );
}
