export default function SkeletonCard() {
  return (
    <div className="art-card relative animate-pulse" aria-hidden="true">
      <div className="art-zone flex items-center justify-center px-5">
        <div className="h-[85%] aspect-[4/5] max-w-full border-[6px] border-ink-soft bg-ink-soft" />
      </div>
      <div className="placard-zone w-full max-w-2xl mx-auto px-5 pb-8">
        <div className="placard ml-auto mr-0 w-[92%] max-w-md px-5 py-4 opacity-60">
          <div className="h-5 w-2/3 bg-black/15 rounded-sm" />
          <div className="h-3 w-1/2 bg-black/10 rounded-sm mt-3" />
          <div className="h-3 w-1/3 bg-black/10 rounded-sm mt-2" />
        </div>
      </div>
    </div>
  );
}
