import re
from uuid import uuid4
from functools import lru_cache
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from app.rules.builtin import ANON, rule

# Original small Chinese clause corpus. This assists drafting, never authorizes a rule.
CORPUS = {
    "organization": [
        "匿名稿不得出现学校名称",
        "应删除作者单位及院系",
        "论文不能暴露所属高校",
        "正文不允许标明研究机构",
        "评审材料应隐去学校和单位",
        "禁止出现实验室单位名称",
        "匿名审查不得含机构名称",
        "院校信息必须移除",
    ],
    "person": [
        "不得出现作者姓名",
        "删除指导教师信息",
        "匿名论文不含导师名字",
        "请隐去通讯作者姓名",
        "作者身份不得公开",
        "文稿不得标注学生姓名",
        "导师姓名应删除",
        "论文署名需要匿名化",
    ],
    "contact": [
        "匿名稿应删除电子邮箱",
        "不得留下电话号码",
        "不能显示身份证号码",
        "联系方式必须清除",
        "邮件地址不得出现在正文",
        "去除作者手机号",
        "禁止标明个人联络信息",
        "删除联系电话和邮箱",
    ],
    "funding": [
        "删除致谢中的身份信息",
        "不得出现项目编号",
        "匿名稿应隐去基金项目",
        "资助编号需要删除",
        "致谢不允许暴露个人",
        "基金号码不得出现",
        "感谢导师部分请匿名处理",
        "去除科研课题编号",
    ],
    "hidden": [
        "请删除所有批注",
        "提交前接受修订记录",
        "禁止保留隐藏文字",
        "需要清理文档隐藏内容",
        "材料不得带审阅批注",
        "不允许有未接受修订",
        "隐藏对象应清除",
        "去除修改痕迹",
    ],
    "metadata": [
        "文档作者属性应清除",
        "不得保留文档元数据中的个人信息",
        "Word最后修改人必须删除",
        "PDF作者元信息请清理",
        "文档属性不要显示单位",
        "移除文件公司属性",
        "匿名材料需要清除作者属性",
        "属性中不能出现创建人",
    ],
    "logo": [
        "不得出现学校校徽",
        "匿名稿应删除单位Logo",
        "图片不能暴露机构标识",
        "学校标志必须移除",
        "不允许出现院校图标",
        "图中徽章需要人工复核",
        "禁止包含校名图案",
        "封面不应有单位标识",
    ],
}


@lru_cache
def model():
    x, y = [], []
    for label, clauses in CORPUS.items():
        x.extend(clauses)
        y.extend([label] * len(clauses))
    clf = make_pipeline(
        TfidfVectorizer(analyzer="char", ngram_range=(1, 3)),
        LogisticRegression(C=12, random_state=42, max_iter=400),
    )
    clf.fit(x, y)
    return clf


def draft(text):
    rules, explanation = [], []
    clauses = [c.strip() for c in re.split(r"[\n。；;]", text) if c.strip()]
    classifier = model()
    for clause in clauses[:100]:
        if len(clause) < 4:
            continue
        probabilities = classifier.predict_proba([clause])[0]
        idx = probabilities.argmax()
        target, confidence = str(classifier.classes_[idx]), float(probabilities[idx])
        max_pages = re.search(r"(?:不超过|最多|上限|不得超过)\s*(\d+)\s*页", clause)
        prohibited = any(
            w in clause
            for w in (
                "不得",
                "禁止",
                "删除",
                "隐去",
                "移除",
                "清除",
                "去除",
                "不允许",
                "不能",
                "接受修订",
                "不应",
                "需要清理",
            )
        )
        if max_pages:
            candidate = rule(
                uuid4().hex,
                "格式规范",
                "max_pages",
                clause,
                "format",
                max_pages=int(max_pages[1]),
            )
        elif confidence >= 0.48 and prohibited:
            template = next((r for r in ANON if r["target"] == target), None)
            candidate = dict(template or ANON[0])
            candidate.update(id=uuid4().hex, description=clause)
        else:
            candidate = rule(uuid4().hex, "规则待确认", "manual", clause, "manual")
        candidate["source_clause"] = clause
        rules.append(candidate)
        explanation.append(
            {
                "rule_id": candidate["id"],
                "predicted_target": target,
                "confidence": round(confidence, 3),
                "method": "本地中文 TF-IDF + LogisticRegression",
                "needs_confirmation": True,
            }
        )
    if not rules:
        raise ValueError("规则文件未抽取到可用条款。")
    return {
        "rules": rules,
        "explanations": explanation,
        "notice": "这是待确认草案，不是已生效规则。分类器仅以 56 条自建语料训练；请逐条确认适用范围、禁止条件与检测方法。",
    }
