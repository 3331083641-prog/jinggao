from copy import deepcopy
import hashlib
import json

from fastapi import HTTPException

from app.services.rule_deletion import detection_rules


def selected_rules(ids, task=None):
    ids = list(dict.fromkeys(ids))
    if not ids or len(ids) > 10 or any(not id.strip() for id in ids):
        raise HTTPException(422, "请选择 1–10 份规则")
    members = [deepcopy(detection_rules(id, task)) for id in sorted(ids)]
    if len(members) == 1:
        return members[0]
    rules = []
    for member in members:
        for original in member["rules"]:
            rule = deepcopy(original)
            # The same rule ID can occur in different imported files.
            rule["id"] = member["id"] + ":" + original["id"]
            rule["rule_id"] = rule["id"]
            rule["source_ruleset_id"] = member["id"]
            rule["source_rule_set_id"] = member["id"]
            rule.setdefault("parameters", {}).update(
                source_ruleset_id=member["id"],
                source_ruleset_name=member["name"],
                source_ruleset_version=member["version"],
            )
            rules.append(rule)
    if len(rules) > 100:
        raise HTTPException(
            422, "联合检查项超过 100 条，请减少所选规则；不会丢弃条款。"
        )
    if any(r["parameters"].get("registration_template") for r in rules):
        for rule in rules:
            if rule["parameters"].get("anonymous_policy"):
                rule["parameters"]["registration_cover_review"] = True
    fingerprint = hashlib.sha256(
        json.dumps(members, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()[:32]
    return {
        "id": "combined-" + fingerprint,
        "name": "联合检查（" + str(len(members)) + "份规则）",
        "category": "自定义规则",
        "description": "；".join(member["name"] for member in members),
        "source": "；".join(
            member["name"] + "：" + member.get("source", "用户确认规则")
            for member in members
        ),
        "version": "1.0.0",
        "updated_at": max(member["updated_at"] for member in members),
        "members": members,
        "rules": rules,
    }
