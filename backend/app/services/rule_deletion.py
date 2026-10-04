import json

from fastapi import HTTPException

from app.core import storage as db
from app.rules.builtin import builtins
from app.services.task_deletion import TASK_MUTATION_LOCK


def delete_ruleset(id):
    """Remove a rule from the library while retaining its archival record."""
    if id in {rule["id"] for rule in builtins()}:
        raise HTTPException(403, "内置基础规则不能删除")
    with TASK_MUTATION_LOCK, db.connect() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute("SELECT payload FROM rulesets WHERE id=?", (id,)).fetchone()
        if not row:
            raise HTTPException(404, "规则不存在")
        rule = json.loads(row[0])
        rule.setdefault("deleted_at", db.now())
        con.execute(
            "UPDATE rulesets SET payload=? WHERE id=?",
            (json.dumps(rule, ensure_ascii=False), id),
        )
    return {"id": id, "deleted": True}


def detection_rules(ruleset_id, task=None):
    rules = db.get("rulesets", ruleset_id)
    if rules and not rules.get("deleted_at"):
        return rules
    # A historical task can repeat its original checks using its immutable snapshot.
    if task:
        for run_id in reversed(task.get("run_ids", [])):
            run = db.get("runs", run_id)
            if run and run["ruleset_id"] == ruleset_id:
                return run["ruleset_snapshot"]
    raise HTTPException(404, "规则已删除或不存在，请重新选择规则")
