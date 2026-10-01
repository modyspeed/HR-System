interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "", lines = 1 }: SkeletonProps) {
  return (
    <span aria-hidden="true" className={`ui-skeleton ${className}`}>
      {Array.from({ length: lines }, (_, index) => <span key={index} />)}
    </span>
  );
}