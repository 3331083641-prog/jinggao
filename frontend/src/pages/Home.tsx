import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  FileText,
  Layers,
  RefreshCw,
  BookOpen,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { PageHero, FileIcon, StatusBadge, Empty } from "../components/ui";
import { useTasks, date } from "../api";
import { HeroDocumentScene } from "../components/three/HeroDocumentScene";
export function Home() {
  const [active, setActive] = useState(false);
  const [rulesActive, setRulesActive] = useState(false);
  const { data: tasks, isError } = useTasks();
  return (
    <>
      <PageHero
        title="净稿"
        subtitle="科研竞赛材料智能合规助手"
        home
        visual={<HeroDocumentScene active={active} rulesActive={rulesActive} />}
      >
        <p className="hero-description">提交之前，再检查一次。</p>
        <div className="hero-actions">
          <Link
            to="/new"
            className="button primary"
            onMouseEnter={() => setActive(true)}
            onMouseLeave={() => setActive(false)}
            onFocus={() => setActive(true)}
            onBlur={() => setActive(false)}
          >
            开始检测
            <ArrowRight size={19} />
          </Link>
          <Link
            to="/rules"
            className="button"
            onMouseEnter={() => setRulesActive(true)}
            onMouseLeave={() => setRulesActive(false)}
            onFocus={() => setRulesActive(true)}
            onBlur={() => setRulesActive(false)}
          >
            <BookOpen size={21} />
            查看规则库
          </Link>
        </div>
      </PageHero>
      <section className="home-values">
        <div className="home-capabilities">
          {[
            [FileText, "读懂提交规则", "基于真实提交规则，识别材料风险。"],
            [Layers, "检查文档表层", "检查文字、隐藏信息与图片。"],
            [RefreshCw, "整改后，再验证", "对比每次结果，验证整改效果。"],
          ].map(([I, t, d]) => {
            const Icon = I as typeof FileText;
            return (
              <div className="capability" key={String(t)}>
                <span>
                  <Icon size={28} />
                </span>
                <div>
                  <h3>{String(t)}</h3>
                  <p>{String(d)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel home-recent">
        <div className="section-title">
          <h2>最近的检测</h2>
          <Link to="/history" className="text-link">
            查看全部
            <ChevronRight size={16} />
          </Link>
        </div>
        {isError ? (
          <Empty title="本地服务暂未连接" text="启动本地后端后即可查看任务。" />
        ) : tasks?.length ? (
          <div className="table-scroll">
            <table className="recent-list">
              <thead>
                <tr>
                  <th>文件名称</th>
                  <th>检测时间</th>
                  <th>不合规</th>
                  <th>需确认</th>
                  <th>通过</th>
                  <th>状态</th>
                  <th aria-label="查看" />
                </tr>
              </thead>
              <tbody>
                {tasks.slice(0, 3).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link className="table-file" to={"/workbench/" + t.id}>
                        <FileIcon format={t.name.split(".").pop()} />
                        <b>{t.name}</b>
                      </Link>
                    </td>
                    <td>{date(t.latest_run.created_at)}</td>
                    <td className="red count">{t.latest_run.counts.FAIL}</td>
                    <td className="orange count">
                      {t.latest_run.counts.REVIEW}
                    </td>
                    <td className="green count">{t.latest_run.counts.PASS}</td>
                    <td>
                      <StatusBadge status={t.latest_run.status} />
                    </td>
                    <td>
                      <Link
                        className="icon-button"
                        aria-label={"查看任务 " + t.name}
                        to={"/workbench/" + t.id}
                      >
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="home-empty">
            <ShieldCheck size={24} />
            <div>
              <b>从第一份材料开始</b>
              <p>完成检查后，最近记录会显示在这里。</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
