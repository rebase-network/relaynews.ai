import type { ReactNode, SVGProps } from "react";
import rebaseLogoUrl from "../assets/rebase-logo-wordmark-white-text.svg";
import {
  GITHUB_REPOSITORY_URL,
  REBASE_NETWORK_URL,
  Link,
  NavLink,
  clsx,
  useEffect,
  useLocation,
  useState,
} from "../shared-base";

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" {...props}>
      <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.85 10.92.57.1.78-.25.78-.56 0-.27-.01-1.17-.02-2.13-3.19.7-3.86-1.35-3.86-1.35-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.69.08-.69 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.47.11-3.06 0 0 .96-.31 3.15 1.18A10.94 10.94 0 0 1 12 6.34c.97 0 1.95.13 2.86.39 2.18-1.49 3.14-1.18 3.14-1.18.62 1.59.23 2.77.11 3.06.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.41-5.26 5.7.41.35.78 1.03.78 2.08 0 1.5-.01 2.7-.01 3.06 0 .31.2.67.79.56a11.52 11.52 0 0 0 7.84-10.92C23.5 5.66 18.35.5 12 .5Z" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navItems = [
    ["/", "首页"],
    ["/leaderboard", "榜单"],
    ["/methodology", "评测方式"],
    ["/submit", "提交站点"],
    ["/probe", "站点测试"],
  ] as const;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="site-shell min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="site-header">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="site-header-bar">
            <Link to="/" className="site-brand">
              <div className="site-brand-mark">
                <span className="bg-[#ffd900]" />
                <span className="bg-[#ffa110]" />
                <span className="bg-[#fb6424]" />
                <span className="bg-[#fa520f]" />
              </div>
              <div>
                <span className="block">relaynew.ai</span>
                <span className="hidden text-[0.6rem] tracking-[0.2em] text-black/44 md:block">
                  relay 健康度、延迟、价格与可信度
                </span>
              </div>
            </Link>
            <button
              aria-controls="mobile-primary-nav"
              aria-expanded={mobileNavOpen}
              className="mobile-nav-toggle md:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              type="button"
            >
              {mobileNavOpen ? "关闭菜单" : "打开菜单"}
            </button>
            <nav className="site-nav hidden md:flex md:flex-wrap md:items-center">
              {navItems.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => clsx("site-nav-link", isActive && "site-nav-link-active")}
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          {mobileNavOpen ? (
            <nav className="site-mobile-nav panel mt-3 md:hidden" id="mobile-primary-nav">
              {navItems.map(([to, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx("site-nav-link", "justify-center text-center", isActive && "site-nav-link-active")
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="site-main mx-auto max-w-7xl px-5 lg:px-10">{children}</main>
      <footer className="site-footer px-5 py-6 md:py-7 lg:px-10">
        <div className="site-footer-shell mx-auto max-w-7xl">
          <div className="site-footer-inline">
            <p className="site-footer-meta">© {currentYear} relaynew.ai</p>
            <div className="site-footer-link-list">
              <a
                aria-label="Rebase"
                className="site-footer-mark-link"
                href={REBASE_NETWORK_URL}
                rel="noreferrer"
                target="_blank"
              >
                <img alt="" aria-hidden="true" className="site-footer-mark-image" src={rebaseLogoUrl} />
              </a>
              <a
                aria-label="GitHub repository"
                className="site-footer-github"
                href={GITHUB_REPOSITORY_URL}
                rel="noreferrer"
                target="_blank"
              >
                <GitHubIcon className="site-footer-github-icon" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Panel({
  title,
  kicker,
  children,
  className,
  headerClassName,
  titleClassName,
  kickerClassName,
}: {
  title?: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  kickerClassName?: string;
}) {
  return (
    <section className={clsx("panel", className)}>
      {(kicker || title) && (
        <header className={clsx("mb-4", headerClassName)}>
          {kicker ? <p className={clsx("kicker", kickerClassName)}>{kicker}</p> : null}
          {title ? (
            <h2 className={clsx("text-3xl leading-[0.95] tracking-[-0.04em] md:text-[2.9rem]", titleClassName)}>
              {title}
            </h2>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}

export function LoadingPanel() {
  return <div className="panel text-sm uppercase tracking-[0.15em] text-black/60">加载中...</div>;
}

export function ErrorPanel({ message }: { message: string }) {
  return <div className="panel border border-[#fa520f]/20 bg-[#fff0c2] text-sm text-[#7b3614]">{message}</div>;
}
