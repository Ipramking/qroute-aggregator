export default function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* faint grid */}
      <div className="hairline-grid absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      {/* orange orb (energy / local) */}
      <div className="absolute -left-32 top-[-10%] h-[36rem] w-[36rem] rounded-full bg-primary/20 blur-[140px]" />
      {/* cyan orb (cross-shard) */}
      <div className="absolute -right-40 top-[30%] h-[34rem] w-[34rem] rounded-full bg-accent/10 blur-[150px]" />
      {/* base vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_40%,rgb(var(--background))_100%)]" />
    </div>
  );
}
