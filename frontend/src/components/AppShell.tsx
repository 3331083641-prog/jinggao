import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, Suspense } from "react";
import {
  Home,
  FilePlus2,
  LayoutGrid,
  History,
  BookOpen,
  ChartNoAxesColumn,
  LockKeyhole,
} from "lucide-react";
const links = [
  ["/", "首页", Home],
  ["/new", "新建检测", FilePlus2],
  ["/workspace", "工作台", LayoutGrid],
  ["/history", "历史任务", History],
  ["/rules", "规则库", BookOpen],
  ["/reports", "报告中心", ChartNoAxesColumn],
] as const;
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
        <span className="local-label">
          <LockKeyhole size={14} />
          本地处理 · 隐私优先
        </span>
      </header>
      <aside className="sidebar">
        <nav aria-label="主要导航">
          {links.map(([path, name, Icon], i) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""} ${i === 4 ? "nav-separate" : ""}`
              }
            >
              <Icon size={21} />
              <span>{name}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="small-dot" />
          每一次提交，都更安心<small>科研竞赛材料智能合规助手</small>
        </div>
      </aside>
      <main className="main-content">
        <div className="content-width">
          <Suspense
            fallback={<div className="page-loading">正在读取页面…</div>}
          >
            <Outlet />
          </Suspense>
        </div>
        <footer className="app-footer">
          净稿 · 提交之前，再检查一次。
          <span>仅针对所选规则，检测结果需结合人工复核</span>
        </footer>
      </main>
    </div>
  );
}
