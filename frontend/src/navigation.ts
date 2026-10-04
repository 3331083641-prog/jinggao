import {
  Home,
  FilePlus2,
  LayoutGrid,
  History,
  BookOpen,
  ChartNoAxesColumn,
} from "lucide-react";

// The only source of sidebar navigation. Pages render content through AppShell's Outlet.
export const navigationItems = [
  { path: "/", name: "首页", icon: Home },
  { path: "/new", name: "新建检测", icon: FilePlus2 },
  { path: "/workbench", name: "工作台", icon: LayoutGrid },
  { path: "/history", name: "历史任务", icon: History },
  { path: "/rules", name: "规则库", icon: BookOpen, separated: true },
  { path: "/reports", name: "报告中心", icon: ChartNoAxesColumn },
];
