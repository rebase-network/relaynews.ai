import {
  ADMIN_AUTH_REQUIRED_EVENT,
  AdminLogin,
  AdminShell,
  ApiRequestError,
  Navigate,
  Route,
  Routes,
  readStoredAdminAuthorization,
  useEffect,
  useState,
  verifyAdminAccess,
  writeStoredAdminAuthorization,
} from "./shared";
import { CredentialsPage } from "./pages/credentials-page";
import { IntakePage } from "./pages/intake-page";
import { ModelsPage } from "./pages/models-page";
import { OverviewPage } from "./pages/overview-page";
import { PricesPage } from "./pages/prices-page";
import { RelayHistoryPage } from "./pages/relay-history-page";
import { RelaysPage } from "./pages/relays-page";
import { SponsorsPage } from "./pages/sponsors-page";
import { SubmissionHistoryPage } from "./pages/submission-history-page";

function AdminBootstrapCard({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="admin-shell min-h-screen bg-[var(--bg)] text-white">
      <main className="admin-main mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 lg:px-10">
        <section className="card w-full max-w-md">
          <h1 className="text-3xl tracking-[-0.04em] md:text-[2rem]">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/62">{message}</p>
          {actionLabel && onAction ? (
            <button className="pill pill-active mt-5" type="button" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/relays" element={<RelaysPage />} />
      <Route path="/relays/:relayId" element={<Navigate replace to="/relays" />} />
      <Route path="/relays/history" element={<RelayHistoryPage />} />
      <Route path="/intake" element={<IntakePage />} />
      <Route path="/intake/history" element={<SubmissionHistoryPage />} />
      <Route path="/submissions" element={<Navigate replace to="/intake" />} />
      <Route path="/credentials" element={<CredentialsPage />} />
      <Route path="/sponsors" element={<SponsorsPage />} />
      <Route path="/models" element={<ModelsPage />} />
      <Route path="/prices" element={<PricesPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export function App() {
  const [authState, setAuthState] = useState<import("./shared").AdminAccessState>({ status: "checking" });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const storedAuthorization = readStoredAdminAuthorization();

      try {
        await verifyAdminAccess(storedAuthorization);

        if (active) {
          setAuthState({
            status: "ready",
            showLogout: Boolean(storedAuthorization),
          });
        }
      } catch (reason) {
        if (!active) {
          return;
        }

        if (reason instanceof ApiRequestError && reason.statusCode === 401) {
          writeStoredAdminAuthorization(null);
          setAuthState({ status: "login" });
          return;
        }

        setAuthState({
          status: "error",
          message: reason instanceof Error ? reason.message : "无法连接管理 API。",
        });
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handleAuthRequired() {
      writeStoredAdminAuthorization(null);
      setAuthState({ status: "login" });
    }

    window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleAuthRequired);

    return () => {
      window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, []);

  function handleAuthenticated(authorization: string | null) {
    setAuthState({
      status: "ready",
      showLogout: Boolean(authorization),
    });
  }

  function handleLogout() {
    writeStoredAdminAuthorization(null);
    setAuthState({ status: "login" });
  }

  if (authState.status === "checking") {
    return (
      <AdminBootstrapCard
        title="正在检查管理权限"
        message="正在确认管理 API 是否需要登录凭据，然后再加载控制台。"
      />
    );
  }

  if (authState.status === "error") {
    return (
      <AdminBootstrapCard
        title="管理 API 暂时不可用"
        message={authState.message}
        actionLabel="重试"
        onAction={() => window.location.reload()}
      />
    );
  }

  if (authState.status === "login") {
    return <AdminLogin onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AdminShell onLogout={handleLogout} showLogout={authState.showLogout}>
      <AdminRoutes />
    </AdminShell>
  );
}
