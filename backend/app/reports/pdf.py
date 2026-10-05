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
            f"文件格式：{document['format']} · {document['size']} bytes · SHA-256 {document['sha256']}"
        ),
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
    story.append(p("规则快照与原文", heading))
    for rule in run["ruleset_snapshot"]["rules"]:
        story.extend(
            [
                p(rule["description"], heading),
                p(
                    "原文："
                    + (
                        rule.get("original_text")
                        or rule.get("source_clause")
                        or "用户直接创建规则"
                    )
                ),
                p(
                    "来源："
                    + (
                        rule.get("source_document")
                        or rule.get("parameters", {}).get("source_file")
                        or run["ruleset_snapshot"].get("source", "")
                    )
                ),
                p(
                    "位置："
                    + (
                        f"第 {rule['source_page']} 页 · "
                        if rule.get("source_page")
                        else ""
                    )
                    + rule.get("source_section", "")
                ),
                p("规则 ID：" + rule["id"] + "；检测范围：" + ", ".join(rule["scope"])),
            ]
        )
        if rule.get("condition") or rule.get("exception"):
            story.append(
                p(
                    "条件/例外："
                    + rule.get("condition", "")
                    + "；"
                    + rule.get("exception", "")
                )
            )
    story.append(p("检测覆盖", heading))
    if run.get("coverage_matrix"):
        rows = [[p("规则"), p("状态"), p("Detector / 范围"), p("覆盖说明")]]
        for entry in run["coverage_matrix"]:
            rows.append(
                [
                    p(entry["rule"]),
                    p(entry["status"]),
                    p(
                        " / ".join(entry["detectors"])
                        + "\n"
                        + " / ".join(entry["scope"])
                    ),
                    p(entry["coverage"]),
                ]
            )
        matrix = Table(rows, colWidths=[140, 65, 120, 155], repeatRows=1, splitInRow=1)
        matrix.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f5f2eb")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(matrix)
    else:
        story.append(p("此历史 Run 未保存覆盖矩阵，不推测已验证范围。"))
    if run.get("remediation"):
        story.append(p("安全整改副本", heading))
        story.append(p("原文件 SHA-256：" + run["remediation"]["source_sha256"]))
        for change in run["remediation"].get("changes", []):
            story.append(p(change["description"] + " · " + change["location"]))
    if run.get("parent_run_id"):
        from app.services.run_diff import compare_runs

        before = db.get("runs", run["parent_run_id"])
        if before:
            diff = compare_runs(before, run)
            story.append(p("Run 对比与证据变化", heading))
            for status, counts in diff["counts"].items():
                story.append(p(f"{status}：{counts['before']} → {counts['after']}"))
            story.append(p(diff["note"]))
            if not diff["comparable"]:
                story.append(
                    p("快照、范围或完成状态不同，不将数值变化解释为整改效果。")
                )
            for pair in diff["pairs"]:
                story.append(p("变化：" + pair["category"]))
                if pair["before"]:
                    story.append(p("旧 Evidence：" + pair["before"]["evidence"]))
                if pair["after"]:
                    story.append(p("新 Evidence：" + pair["after"]["evidence"]))
    if run.get("diagnostics"):
        story.append(p("系统诊断（不计为违规）", heading))
        for diagnostic in run["diagnostics"]:
            story.append(p(diagnostic["evidence"]))
    crops = 0
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
                p(
                    f"页码：{f['page']}"
                    if f.get("page")
                    else "无可靠页码；使用结构位置"
                ),
                p("检测器：" + f["detector"] + f" / 置信度 {f['confidence']:.2f}"),
                p("判断：" + f["reason"]),
                p("整改建议：" + f["suggestion"]),
            ]
        )
        if crops < 6 and f["status"] != "PASS":
            from app.reports.evidence_image import evidence_image

            crop = evidence_image(document, f)
            if crop is not None:
                story.append(crop)
                crops += 1
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
