import * as Shared from "../shared-base";

const { HOME_LEADERBOARD_ROW_LIMIT, clsx } = Shared;

export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx("skeleton-block", className)} />;
}

export function HomePageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      <section className="panel hero-panel min-h-0">
        <div className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr] xl:items-start">
          <div className="space-y-4">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-heading-lg max-w-[30rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[26rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="skeleton-line max-w-[31rem]" />
              <SkeletonBlock className="skeleton-line max-w-[26rem]" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <SkeletonBlock className="skeleton-button w-[12.8rem]" />
              <SkeletonBlock className="skeleton-button w-[7rem]" />
              <SkeletonBlock className="skeleton-button w-[8.8rem]" />
            </div>
          </div>
          <div className="quick-probe-card quick-probe-form">
            <div className="quick-probe-header">
              <SkeletonBlock className="skeleton-kicker w-[7.5rem]" />
              <SkeletonBlock className="skeleton-pill w-[7.2rem]" />
            </div>
            <div className="space-y-3">
              {["基础 URL", "API 密钥", "目标模型"].map((label) => (
                <div key={label} className="form-field-inline quick-probe-field">
                  <SkeletonBlock className="skeleton-kicker h-4 w-[4.8rem]" />
                  <SkeletonBlock className="skeleton-input" />
                </div>
              ))}
            </div>
            <div className="quick-probe-footer">
              <SkeletonBlock className="skeleton-line max-w-[18rem]" />
              <SkeletonBlock className="skeleton-button w-[7.8rem]" />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[7rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[17rem]" />
            <SkeletonBlock className="skeleton-line max-w-[30rem]" />
          </div>
          <SkeletonBlock className="skeleton-button w-[10rem]" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <LeaderboardPreviewSkeleton key={index} />
          ))}
        </div>
      </section>

      <section className="home-bridge">
        <SkeletonBlock className="skeleton-line max-w-[28rem]" />
        <div className="home-bridge-actions">
          <SkeletonBlock className="skeleton-pill w-[7.4rem]" />
          <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
        </div>
      </section>

      <section className="panel">
        <div className="mb-4 space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[7rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[14rem]" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card p-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[9rem]" />
                  <SkeletonBlock className="skeleton-pill w-[5.2rem]" />
                </div>
                <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LeaderboardPreviewSkeleton() {
  return (
    <section className="panel h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[11rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[14rem]" />
          <SkeletonBlock className="skeleton-line max-w-[12rem]" />
        </div>
        <SkeletonBlock className="skeleton-pill w-[8.6rem]" />
      </div>
      <div className="mt-5 space-y-2.5">
        {Array.from({ length: HOME_LEADERBOARD_ROW_LIMIT }).map((_, index) => (
          <div key={index} className="surface-card p-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <SkeletonBlock className="skeleton-kicker w-[2rem]" />
                <SkeletonBlock className="skeleton-line max-w-[11rem]" />
                <div className="flex flex-wrap gap-1.5">
                  <SkeletonBlock className="skeleton-pill w-[4.8rem]" />
                  <SkeletonBlock className="skeleton-pill w-[4.2rem]" />
                </div>
              </div>
              <div className="min-w-[8.5rem] space-y-2">
                <SkeletonBlock className="skeleton-pill ml-auto w-[6rem]" />
                <SkeletonBlock className="skeleton-line ml-auto max-w-[5rem]" />
                <SkeletonBlock className="skeleton-line ml-auto max-w-[7rem]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LeaderboardDirectorySkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr] xl:items-end">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[10rem]" />
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-heading-lg max-w-[29rem]" />
              <SkeletonBlock className="skeleton-heading-lg max-w-[24rem]" />
            </div>
            <SkeletonBlock className="skeleton-line max-w-[31rem]" />
          </div>
          <div className="flex flex-wrap gap-2.5 xl:justify-end">
            <SkeletonBlock className="skeleton-button w-[10.4rem]" />
            <SkeletonBlock className="skeleton-button w-[8.4rem]" />
          </div>
        </div>
      </section>

      <section className="directory-filters directory-filters-compact">
        <div className="directory-vendor-row">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="skeleton-pill w-[5.5rem]" />
          ))}
        </div>
        <SkeletonBlock className="skeleton-line max-w-[10rem]" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <LeaderboardPreviewSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function LeaderboardPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
            <SkeletonBlock className="skeleton-line max-w-[14rem]" />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <SkeletonBlock className="skeleton-button w-[10.8rem]" />
            <SkeletonBlock className="skeleton-button w-[8rem]" />
          </div>
        </div>
      </section>

      <section className="panel-soft border border-black/8 px-4 py-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[9rem]" />
            <SkeletonBlock className="skeleton-line max-w-[26rem]" />
          </div>
          <div className="leaderboard-model-switcher">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={index} className="skeleton-pill w-[7rem]" />
            ))}
          </div>
        </div>
      </section>

      <section className="leaderboard-row-filters">
        <div className="leaderboard-row-filter-grid">
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-input" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[4rem]" />
            <SkeletonBlock className="skeleton-input" />
          </div>
        </div>
        <div className="directory-vendor-row">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock key={index} className="skeleton-pill w-[6.2rem]" />
          ))}
        </div>
        <SkeletonBlock className="skeleton-line max-w-[11rem]" />
      </section>

      <section className="panel">
        <div className="mb-4 space-y-2">
          <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
          <SkeletonBlock className="skeleton-heading-md max-w-[18rem]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="surface-card p-4">
              <div className="grid gap-3 lg:grid-cols-[4.5rem_minmax(0,1.2fr)_minmax(0,0.8fr)_repeat(4,minmax(0,0.55fr))] lg:items-center">
                <SkeletonBlock className="skeleton-line max-w-[3rem]" />
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[11rem]" />
                  <div className="flex flex-wrap gap-2">
                    <SkeletonBlock className="skeleton-pill w-[4.4rem]" />
                    <SkeletonBlock className="skeleton-pill w-[5rem]" />
                  </div>
                </div>
                <SkeletonBlock className="skeleton-pill w-[5.8rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4.6rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
                <SkeletonBlock className="skeleton-line max-w-[4rem]" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function RelayPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[linear-gradient(135deg,rgba(255,240,194,1),rgba(255,184,62,0.75))]">
        <div className="relative z-20 grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem] lg:items-start">
          <div className="space-y-4">
            <div className="space-y-3">
              <SkeletonBlock className="skeleton-pill w-[10rem]" />
              <div className="space-y-3">
                <SkeletonBlock className="skeleton-heading-lg max-w-[18rem]" />
                <SkeletonBlock className="skeleton-line max-w-[20rem]" />
                <SkeletonBlock className="skeleton-line max-w-[32rem]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <SkeletonBlock className="skeleton-pill w-[5rem]" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="metric-card">
                  <SkeletonBlock className="skeleton-kicker max-w-[6rem]" />
                  <SkeletonBlock className="skeleton-heading-md mt-4 max-w-[5rem]" />
                </div>
              ))}
            </div>
          </div>
          <div className="surface-card p-4">
            <SkeletonBlock className="skeleton-kicker max-w-[5rem]" />
            <SkeletonBlock className="skeleton-heading-md mt-3 max-w-[5.5rem]" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock key={index} className="skeleton-line max-w-[8rem]" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
          </div>
          <SkeletonBlock className="h-28 w-full" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[4.2rem] w-full" />
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[6rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[10rem]" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 15 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-10 w-full" />
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <SkeletonBlock key={index} className="h-[4.2rem] w-full" />
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[18rem]" />
          </div>
          <div className="space-y-2.5 lg:hidden">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="surface-card p-3.5">
                <div className="space-y-2">
                  <SkeletonBlock className="skeleton-line max-w-[10rem]" />
                  <SkeletonBlock className="skeleton-line max-w-[7rem]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <SkeletonBlock className="h-[4.3rem] w-full" />
                  <SkeletonBlock className="h-[4.3rem] w-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
            {Array.from({ length: 2 }).map((_, tableIndex) => (
              <div key={tableIndex} className="space-y-2">
                <SkeletonBlock className="h-9 w-full" />
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-14 w-full" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

export function MethodologyPageSkeleton() {
  return (
    <div aria-busy="true" className="space-y-6">
      <section className="panel bg-[#fff0c2]">
        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-3">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[26rem]" />
            <SkeletonBlock className="skeleton-heading-lg max-w-[20rem]" />
            <div className="space-y-2">
              <SkeletonBlock className="skeleton-line max-w-[30rem]" />
              <SkeletonBlock className="skeleton-line max-w-[24rem]" />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <SkeletonBlock className="skeleton-button w-[11rem]" />
              <SkeletonBlock className="skeleton-button w-[8rem]" />
            </div>
          </div>
          <div className="surface-card p-4">
            <SkeletonBlock className="skeleton-kicker max-w-[9rem]" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <SkeletonBlock className="skeleton-line max-w-[8rem]" />
                    <SkeletonBlock className="skeleton-line max-w-[3rem]" />
                  </div>
                  <SkeletonBlock className="h-2.5 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
        <section className="panel">
          <div className="mb-4 space-y-2">
            <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
            <SkeletonBlock className="skeleton-heading-md max-w-[15rem]" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="surface-card p-3.5">
                <SkeletonBlock className="skeleton-pill w-[6rem]" />
                <div className="mt-3 space-y-2">
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-line max-w-[90%]" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="space-y-4">
          <section className="panel">
            <div className="mb-4 space-y-2">
              <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
              <SkeletonBlock className="skeleton-heading-md max-w-[12rem]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-3.5">
                  <SkeletonBlock className="skeleton-pill w-[5.5rem]" />
                  <div className="mt-3 space-y-2">
                    <SkeletonBlock className="skeleton-line" />
                    <SkeletonBlock className="skeleton-line max-w-[85%]" />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="mb-4 space-y-2">
              <SkeletonBlock className="skeleton-kicker max-w-[8rem]" />
              <SkeletonBlock className="skeleton-heading-md max-w-[13rem]" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="surface-card p-3.5">
                  <SkeletonBlock className="skeleton-line" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
