interface SkeletonRowProps {
  columns?: number;
}

export function SkeletonRow({ columns = 4 }: SkeletonRowProps) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-3">
          <div className={`h-4 bg-gray-200 rounded ${i === 0 ? 'w-1/4' : 'w-full'}`} />
        </td>
      ))}
    </tr>
  );
}
