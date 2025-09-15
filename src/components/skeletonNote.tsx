// src/components/SkeletonNote.tsx
export default function SkeletonNote() {
  return (
    <div className="bg-white border rounded-lg shadow-sm w-56 h-[150px] p-2 flex flex-col">
      <div className="h-6 w-1/3 bg-gray-200 rounded animate-pulse mb-2" />
      <div className="flex-grow w-full bg-gray-200 rounded animate-pulse" />
    </div>
  );
}