from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from app.core import storage as db

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))


def generate(run, document):
    path = db.DATA / "reports" / (run["id"] + ".pdf")
    style = ParagraphStyle(
        "body",
        fontName="STSong-Light",
        fontSize=10,
        leading=17,
        textColor=colors.HexColor("#1d2939"),
        wordWrap="CJK",
    )
    title = ParagraphStyle(
        "title", parent=style, fontSize=25, leading=36, spaceAfter=18
    )
    heading = ParagraphStyle(
        "heading", parent=style, fontSize=13, leading=21, spaceBefore=14, spaceAfter=6
    )

    def p(text, sty=style):
        return Paragraph(escape(str(text)).replace("\n", "<br/>"), sty)

    story = [
        p("净稿 · 材料合规检测报告", title),
        p(document["name"], heading),
        p("检测时间：" + run["created_at"]),
        p(
            "规则集："
            + run["ruleset_snapshot"]["name"]
            + " · "
            + run["ruleset_snapshot"]["version"]
        ),
        p(f"任务 {run['task_id']} / Run {run['version']} / {run['id']}"),
        p("检测结论：" + run["status"]),
        p("执行模式：" + run.get("execution_mode", "历史规则快照")),
        p(
            f"本次执行 {len(run.get('rule_ids_executed', run['ruleset_snapshot']['rules']))} 项规则；仅按当前规则集检查。"
        ),
        Spacer(1, 15),
    ]
    table = Table(
        [
            [p("FAIL"), p("REVIEW"), p("PASS")],
            [
                p(run["counts"]["FAIL"]),
                p(run["counts"]["REVIEW"]),
                p(run["counts"]["PASS"]),
            ],
        ],
        colWidths=[160] * 3,
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f2eb")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.extend(
        [
            table,
            Spacer(1, 15),
            p("可信边界", heading),
            p(
                "本报告仅针对所选规则与已检查表层。PASS 不等于材料绝对无风险；REVIEW 需要人工判断。原文件仅在本机解析，OCR 使用本地模型。"
            ),
            p("检查范围：" + ", ".join(run["scopes"])),
            p(
                "统计按检测发现计数，并非独立违规条款数；同一条款可能包含多个位置与覆盖提醒。"
            ),
            p("规则来源：" + run["ruleset_snapshot"].get("source", "用户确认规则")),
        ]
    )
    if run.get("error"):
        story.append(p(run["error"]))
    if run.get("diagnostics"):
        story.append(p("系统诊断（不计为违规）", heading))
        for diagnostic in run["diagnostics"]:
            story.append(p(diagnostic["evidence"]))
    for f in run["findings"]:
        rule = next(
            (r for r in run["ruleset_snapshot"]["rules"] if r["id"] == f["rule_id"]), {}
        )
        story.extend(
            [
                p(f"[{f['status']}] {f['title']}", heading),
                p("规则依据：" + (rule.get("source_clause") or "检测覆盖边界")),
                p(
                    "来源文件："
                    + rule.get("parameters", {}).get(
                        "source_file", "基础规则 / 检测覆盖说明"
                    )
                ),
                p("证据：" + f["evidence"]),
                p("位置：" + f["location"]),
                p("检测器：" + f["detector"] + f" / 置信度 {f['confidence']:.2f}"),
                p("判断：" + f["reason"]),
                p("整改建议：" + f["suggestion"]),
            ]
        )
        if f.get("resolution"):
            story.append(
                p(
                    "人工记录："
                    + {
                        "pending": "待确认",
                        "confirmed": "确认问题",
                        "dismissed": "非问题",
                        "fixed": "已记录整改，待复检",
                    }.get(f["resolution"]["decision"], f["resolution"]["decision"])
                    + "；"
                    + f["resolution"].get("note", "")
                )
            )
        if f.get("ai_review"):
            a = f["ai_review"]
            story.append(
                p(f"AI 局部语境提示：{a['label']} / 得分 {a['score']:.2f}。{a['note']}")
            )

    def footer(c, doc):
        c.setFont("STSong-Light", 9)
        c.setFillColor(colors.HexColor("#80858b"))
        c.drawString(42, 26, "净稿 · 本地检查 / 规则与证据可追溯")
        c.drawRightString(A4[0] - 42, 26, str(doc.page))

    SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=42,
        bottomMargin=45,
        title="净稿合规检测报告",
        author="净稿",
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    return path
