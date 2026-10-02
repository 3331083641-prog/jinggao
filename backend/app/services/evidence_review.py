from functools import lru_cache
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

# Original small illustrative corpus; labels are advisory and cannot change status.
CONTEXTS = {
    "作者归属线索": [
        "作者单位位于某大学",
        "作者所在学院",
        "本研究在本校实验室完成",
        "本校资助了本团队项目",
        "指导教师来自该研究所",
        "通讯作者单位信息",
        "本研究获得导师支持",
        "本文作者就读于高校",
        "本研究团队隶属于大学",
        "致谢指导老师帮助",
        "作者姓名与单位",
        "通讯地址属于作者所在院系",
    ],
    "引用或背景线索": [
        "参考文献报道了某大学的成果",
        "公开资料引用实验室研究",
        "文献中提到学校名称",
        "引用某研究所公开论文",
        "已有研究来自其他单位",
        "参考资料介绍该学院",
        "公开算法由高校研究组发表",
        "综述引用其他团队成果",
        "某大学发表研究作为背景",
        "参考文献中的学者姓名",
        "背景中比较其他研究机构",
        "相关工作介绍已发表的文献",
    ],
    "语境不充分": [
        "名称出现但缺少上下文",
        "孤立的研究所文字",
        "只有一个学院名称",
        "学校图案文字未说明作者",
        "人物姓名无标签",
        "项目编号没有归属说明",
        "单独一行邮箱",
        "图中学校没有上下文",
        "扫描页文本不完整",
        "机构名字在链接里",
        "姓名出现在未知位置",
        "无法判断内容归属",
    ],
}


@lru_cache
def model():
    x, y = [], []
    for label, examples in CONTEXTS.items():
        x.extend(examples)
        y.extend([label] * len(examples))
    m = make_pipeline(
        TfidfVectorizer(analyzer="char", ngram_range=(1, 3)),
        LogisticRegression(C=6, max_iter=400, random_state=42),
    )
    m.fit(x, y)
    return m


def review(context):
    m = model()
    p = m.predict_proba([context[:600]])[0]
    i = p.argmax()
    return {
        "label": str(m.classes_[i]),
        "score": round(float(p[i]), 3),
        "model": "本地 TF-IDF + LogisticRegression",
        "context_chars": min(len(context), 600),
        "note": "小型合成语料模型，仅提供语境提示；保留 REVIEW，需要人工确认。",
    }
