import type { ElementType } from 'react';

type EditorialTitleProps = {
  as?: ElementType;
  lead: string;
  emphasis: string;
  trail?: string;
  className?: string;
  emphasisClassName?: string;
};

export function EditorialTitle({
  as: Tag = 'h2',
  lead,
  emphasis,
  trail = '',
  className = '',
  emphasisClassName = 'text-green-600 dark:text-green-400',
}: EditorialTitleProps) {
  return (
    <Tag className={`font-light tracking-tight text-gray-900 dark:text-white ${className}`}>
      {lead}{' '}
      <span className={`font-bold ${emphasisClassName}`}>{emphasis}</span>
      {trail}
    </Tag>
  );
}
