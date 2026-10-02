import { Link } from "react-router-dom";
import {
  ArrowRight,
  ScanText,
  Layers,
  GitCompareArrows,
  BookOpen,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { PageHero, FileIcon, StatusBadge, Empty } from "../components/ui";
import { useTasks, date } from "../api";
export function Home() {
  const { data: tasks, isError } = useTasks();
  return (
    <>
      <PageHero title="净稿" subtitle="科研竞赛材料智能合规助手" home>
        <p className="hero-description">提交之前，再检查一次。</p>
        <div className="hero-actions">
          <Link to="/new" className="button primary">
            开始检测
            <ArrowRight size={17} />
          </Link>
          <Link to="/rules" className="button">
            查看规则库
            <BookOpen size={17} />
          </Link>
        </div>
      </PageHero>
      <section className="home-intro">
        <div>
          <span className="eyebrow">从规则，到安心提交</span>
          <h2>
            把藏在材料里的风险，
            <br />
            变成看得见的证据。
          </h2>
          <p>
            正文之外，还有页眉、属性、批注和图片。
            <br />
            净稿逐层检查，让每一项判断都有据可循。
          </p>
        </div>
        <div className="home-capabilities">
          {[
            [
              ScanText,
              "读懂提交规则",
              "选用基础规则，或导入真实赛事与投稿规范。",
            ],
            [
              Layers,
              "检查文档表层",
              "联查可见文字、隐藏结构、元数据与图像文字。",
            ],
            [
              GitCompareArrows,
              "整改后，再验证",
              "保留每次检测结果，比较风险变化并导出报告。",
            ],
          ].map(([I, t, d]) => {
            const Icon = I as typeof ScanText;
            return (
              <div className="capability" key={String(t)}>
                <span>
                  <Icon size={23} />
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
      <section className="home-recent panel">
        <div className="section-title">
          <div>
            <h2>最近的检测</h2>
            <p>材料留在本机，记录可以随时回看。</p>
          </div>
          <Link to="/history" className="text-link">
            全部任务
            <ChevronRight size={16} />
          </Link>
        </div>
        {isError ? (
          <Empty
            title="本地服务暂未连接"
            text="启动 FastAPI 后端后即可上传和查看任务。"
          />
        ) : tasks?.length ? (
          <div className="recent-list">
            {tasks.slice(0, 3).map((t) => (
              <Link key={t.id} to={"/workspace/" + t.latest_run_id}>
                <FileIcon format={t.name.split(".").pop()} />
                <div>
                  <b>{t.name}</b>
                  <small>
                    {date(t.created_at)} · {t.latest_run.ruleset_snapshot.name}
                  </small>
                </div>
                <StatusBadge status={t.latest_run.status} />
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <ShieldCheck size={24} />
            <div>
              <b>从第一份材料开始</b>
              <p>目前没有检测记录。上传材料后，真实结果会显示在这里。</p>
            </div>
            <Link to="/new" className="button">
              新建检测
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
