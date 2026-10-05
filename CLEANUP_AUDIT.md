# 工程清理审计

范围：仅可再生成的缓存、旧构建与已结束的合成测试运行目录。正式源码、依赖环境、用户材料、SQLite、报告和回退备份均保留。

A 必须提交：frontend/src、backend/app、规则 Schema、检测器、解析器、报告、测试、依赖清单及锁文件、README、架构和第三方披露。

B 可提交：自研程序化 assets、合成 fixture、经过审查的视觉基线、开发验证脚本。

C 禁止提交：密钥与环境配置、用户材料、SQLite、导出报告、OCR 权重与缓存、参考图片、依赖环境、截图/trace/video、回退备份、当地材料操作脚本。

D 安全删除：下表中经用途和绝对路径核对的可再生成内容。没有按文件名猜测删除旧源码。

| 路径 | 字节 | 用途 | 可删除依据 |
|---|---:|---|---|
| .pytest_cache | 7794 | Pytest cache | Tests have completed; recreated automatically |
| .ruff_cache | 27408 | Ruff cache | Static-check cache; recreated automatically |
| frontend/dist | 5074065 | Previous Vite build | Build output; a fresh build follows cleanup |
| frontend/test-results | 45 | Playwright traces and failure artifacts | Validation results retained separately; no product source |
| backend\app\__pycache__ | 16932 | Python bytecode | Recreated automatically; no source |
| backend\app\core\__pycache__ | 3784 | Python bytecode | Recreated automatically; no source |
| backend\app\detectors\__pycache__ | 39805 | Python bytecode | Recreated automatically; no source |
| backend\app\parsers\__pycache__ | 16395 | Python bytecode | Recreated automatically; no source |
| backend\app\reports\__pycache__ | 7724 | Python bytecode | Recreated automatically; no source |
| backend\app\rules\__pycache__ | 3187 | Python bytecode | Recreated automatically; no source |
| backend\app\schemas\__pycache__ | 4921 | Python bytecode | Recreated automatically; no source |
| backend\app\services\__pycache__ | 50754 | Python bytecode | Recreated automatically; no source |
| backend\app\tasks\__pycache__ | 10131 | Python bytecode | Recreated automatically; no source |
| tests\__pycache__ | 160229 | Python bytecode | Recreated automatically; no source |
| tests\generated\e2e-data\1790934235042 | 3252833 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790934332589 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790934402344 | 3252840 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790934537472 | 259906 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790934743390 | 3252829 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790935015120 | 4826040 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790939806608 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790939851389 | 98456 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790939964370 | 1745017 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790940138881 | 5146854 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790940426435 | 5191906 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790940616359 | 5191913 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790941509855 | 2644588 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790941573084 | 512838 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790943927200 | 4780291 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790945778001 | 45056 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790945831513 | 45056 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790945880521 | 45056 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790945994681 | 4878427 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790946411672 | 1689883 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790946660575 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790946804342 | 6102669 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790947074850 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790947111509 | 5838331 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790947486174 | 3371640 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790947696966 | 1273752 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790949466555 | 1224131 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790956320938 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790956420617 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790956878343 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790956947896 | 4801904 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790957304977 | 4801917 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1790998024579 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791001035393 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791001108500 | 4801918 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791001802503 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791002183748 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791002386356 | 4801904 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791003122209 | 77824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791003409153 | 6392370 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791085417542 | 4700465 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791085893025 | 5014849 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791086906014 | 1194661 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791087217698 | 913683 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791088379442 | 469151 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791088541594 | 3591859 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791089225785 | 2174781 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791095979068 | 4477846 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791098327197 | 4591824 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791103295179 | 1012559 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791103463705 | 5812265 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791103844240 | 5333404 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791104329079 | 236804 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791104615072 | 5247836 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791105003908 | 3451630 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791105096172 | 469708 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |
| tests\generated\e2e-data\1791105335797 | 4033735 | Completed synthetic E2E database | Older than one hour; each invocation creates a new database |

计划清理字节：149354447

删除前审计已保存；执行时再次核对绝对路径。

已删除 71 个目标；释放 149354447 字节（按删除前文件长度统计，不含压缩/簇分配差异）。

重新构建当前 dist 后，新产物 5,074,065 字节。相对于删除前文件长度，本轮净减少约 144,280,382 字节（137.6 MiB）；其他正常运行产生的日志不计入此估算。

## 下载缓存与已结束测试的补充清理计划

以下为安装后的下载缓存或已经结束的合成测试临时目录，运行依赖与用户数据保留。

- D:\jinggao\.cache\npm\_cacache：296773524 字节。

- D:\jinggao\.cache\pip：189854193 字节。

- D:\jinggao\.cache\pytest：1026976 字节。

- D:\jinggao\tests\generated\e2e-data：9318530 字节。

补充下载缓存计划未执行：自动安全审查拒绝删除命令，返回 blocked by policy。上述 4 个目录仍保留，未计入释放空间；全部被 Git 忽略。50 MiB 尺寸测试已通过 finally 自行删除临时 fixture。

## 2026-10-05 比赛终版清理审计

计划仅清理 Python/Ruff 可重建缓存；当前依赖、用户原稿和数据库、最新验收证据和源代码保留，均不随源码提交。

|路径|字节|用途 / 删除依据|
|---|---:|---|
|backend\app\__pycache__|23587|可重建编译 / 测试缓存|
|backend\app\core\__pycache__|3784|可重建编译 / 测试缓存|
|backend\app\detectors\__pycache__|40266|可重建编译 / 测试缓存|
|backend\app\parsers\__pycache__|16431|可重建编译 / 测试缓存|
|backend\app\reports\__pycache__|16079|可重建编译 / 测试缓存|
|backend\app\rules\__pycache__|3187|可重建编译 / 测试缓存|
|backend\app\schemas\__pycache__|5625|可重建编译 / 测试缓存|
|backend\app\services\__pycache__|93421|可重建编译 / 测试缓存|
|backend\app\services\rule_compiler\__pycache__|10303|可重建编译 / 测试缓存|
|backend\app\tasks\__pycache__|12000|可重建编译 / 测试缓存|
|tests\__pycache__|232616|可重建编译 / 测试缓存|
|.pytest_cache|13554|可重建编译 / 测试缓存|
|.ruff_cache|2728|可重建编译 / 测试缓存|

计划文件长度合计：473581 字节。自动审批审查拒绝递归删除命令，返回 blocked by policy；本轮没有删除，没有释放空间，不绕过拒绝。所有缓存均不进入Git。
