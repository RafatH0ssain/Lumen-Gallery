export default function SkeletonCard() {
  return (
    <div className="art-card animate-pulse" aria-hidden="true">
      <div className="aspect-[4/5] border-[6px] border-ink-soft bg-ink-soft" />
      <div className="placard ml-auto mr-2 -mt-4 relative w-[85%] max-w-sm px-5 py-4 opacity-60">
        <div className="h-5 w-2/3 bg-black/15 rounded-sm" />
        <div className="h-3 w-1/2 bg-black/10 rounded-sm mt-3" />
      </div>
    </div>
  );
}
