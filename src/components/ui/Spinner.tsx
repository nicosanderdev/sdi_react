type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
type SpinnerTone = 'default' | 'inverse';

const sizeClass: Record<SpinnerSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-[76px] w-[76px]',
};

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
  label?: string;
}

export function Spinner({
  size = 'md',
  tone = 'default',
  className = '',
  label = 'Cargando',
}: SpinnerProps) {
  const outline = tone === 'inverse' ? 'text-white' : 'text-gray-900 dark:text-white';
  const tick = tone === 'inverse' ? 'text-white' : 'text-primary-500 dark:text-primary-400';
  const layout = className.includes('mx-auto') ? 'flex w-fit' : 'inline-flex';

  return (
    <span role="status" className={`${layout} shrink-0 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={`casa-spinner ${sizeClass[size]}`}
        aria-hidden="true"
      >
        <path
          className={`casa-spinner__stroke ${outline}`}
          pathLength="100"
          d="M8 30 L32 10 L56 30 V54 H8 Z"
        />
        <path
          className={`casa-spinner__stroke ${outline}`}
          pathLength="100"
          d="M27 54 V40 H37 V54"
        />
        <path
          className={`casa-spinner__tick ${tick}`}
          pathLength="100"
          d="M26 32 L31 37 L41 25"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
