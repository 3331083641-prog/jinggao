# 首页 Three.js Hero

2026-10-03：按照用户提供的五张 Golden 3D Reference 重建同一个模型，直接用于现有首页。业务页面、文案、导航和真实任务 API 保持原流程。备份：backups/golden-hero-rebuild-20261003-115014/。

## 技术与结构

React 19、Three.js 0.186.1、React Three Fiber 9.8.1。主体全部程序化，无 Blender、GLB、在线模型、HDR 下载或 Bloom。

frontend/src/components/three/：

- HeroDocumentScene：加载、SVG 降级、可见性与首页交互。
- HeroCanvas：统一根 Group、相机、动画时钟、sRGB / ACES。
- DocumentStack / DocumentSheet：四层真实挤出纸张，共享 A4 几何；柔和倒角、暖色侧边、一个标题与七条正文线。
- ShieldMark：外壳、带孔边框、内层、凸面金属表面及实体白色勾。
- OrbitGroup / OrbitPath / OrbitNode：两条不同倾角的闭合 CatmullRom 曲线及闭合 Tube；六个球共享几何和 PBR 材质。
- StudioLighting：本地生成的 RoomEnvironment / PMREM、主光、补光、轮廓光及实时阴影。
- FloatingHeroLabel：真实三维坐标投影到主 React root 的三个中文 DOM 标签。

Drei 已安装并登记许可；Html 原型曾出现 StrictMode 下独立 root 卸载竞态，因此保留可靠的投影 DOM。没有关闭 StrictMode、修改依赖源码或过滤异常。

## 交互与运动

文档轻浮动，盾牌缓慢呼吸。Orbit A 三球一圈 16 秒，Orbit B 三球一圈 22 秒，各自 phase 不同；全部通过对应曲线 getPointAt 更新局部坐标。根 Group 视差限制 X 2° / Y 3°，球与轨道保持一致。

点击文档：前移并显示“规则 → 检测 → 证据”两秒。点击盾牌：短暂放大 5%。开始检测 Hover / Focus：盾牌反射稍增强、球快 10%；查看规则库：标签稍清楚。主体、勾与纸边均有真实厚度。

## 性能与降级

45,448 三角面、32 次绘制、11 个几何资源，桌面 DPR 上限 1.5。可见 Edge 的 60 秒采样为 3,602 个实际渲染帧，约 60 FPS，仅代表本机测试环境。没有每帧创建向量、几何或材质。

离屏或页面隐藏停止渲染；减少动画偏好、平板和低核心数设备使用静态 demand 场景；手机使用原 SVG。卸载清理观察器、监听器、提示定时器、共享资源与 PMREM render target。

首帧前显示 SVG，ready 后淡入。WebGL 不可用、Canvas 异常或 context lost 回退 SVG。场景 aria-hidden；核心文字、入口与最近任务继续使用 DOM。HeroCanvas 懒加载约 944.48 kB / gzip 255.71 kB，仍有 Vite 500 kB 提示，未隐藏警告。业务页面不加载 Three。

动画时钟使用真实帧间耗时，避免低帧率时运动周期变长。离屏暂停，恢复时重置时钟基准，不追赶暂停期间的时间。

## 调试与调参

开发环境 ?heroDebug=1：1 正面、2 左侧、3 右侧、4 俯视、5 底部、0 正式相机。&orbitOnly=1 隐藏主体检查闭环；&helpers=1 显示坐标与网格。所有视角使用同一模型，生产环境关闭入口。

先在 heroSceneConfig.ts 调相机、纸层、盾牌、轨道角度和标签位置，再调材质、光强与周期。盾牌轮廓和凸面生成位于 ShieldMark.tsx；首页专用样式位于 hero.css。

## 验证

三轮及细化后最终截图：review_screenshots/threejs/golden-rebuild/。最终包含 1920×1080、1440×900、1366×768、五个主体视角及五个纯轨道视角。自身截图基线不能证明与参考图像素完全一致。

scripts/verify-hero-orbits.mjs 检查真实网页实例矩阵至少 60 秒：中心线与管面的首尾误差均为 0；六球分别通过接缝至少两次，位置误差小于 1e-5，无跳变或离轨。真实可见 Edge 完整场景也完成 60 秒验证，结果见 docs/golden-hero-live-browser.json。

tests/e2e/three-hero.spec.ts 覆盖实体几何、共享资源、六球运动、闭环、多视角、真实 mesh 点击、CTA、离屏暂停、卸载、减少动画及 WebGL 降级。完整业务回归和最终命令结果记录在 docs/TEST_REPORT.md。
