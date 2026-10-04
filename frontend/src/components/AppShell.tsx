import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { motion } from "framer-motion";
import { navigationItems } from "../navigation";
export function AppShell() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <b>净稿</b>
        </NavLink>
        <span className="brand-line" />
        <span className="brand-sub">让科研成果更纯粹、更专注</span>
        <span
          className="local-label"
          tabIndex={0}
          title="文件与检测数据保存在本机。"
        >
          <LockKeyhole size={14} />
          本地处理 · 隐私优先
        </span>
      </header>
      <aside className="sidebar">
        <nav aria-label="主要导航">
          {navigationItems.map(({ path, name, icon: Icon, separated }) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive || (path === "/workbench" && /^\/(workspace|scan|evidence)(\/|$)/.test(location.pathname)) ? "active" : ""} ${separated ? "nav-separate" : ""}`
              }
            >
              <Icon size={21} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <div className="content-width">
          <Suspense
            fallback={<div className="page-loading">正在读取页面…</div>}
          >
            <motion.div
              key={location.pathname}
              className="page-content"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
