"""Read the supplied final workbook as data; never evaluate cells or follow links."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_sheet(archive, name):
    strings = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        strings = ["".join(item.itertext()) for item in root.findall("s:si", NS)]
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheet = next(item for item in workbook.findall("s:sheets/s:sheet", NS) if item.attrib["name"] == name)
    relation = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    target = targets[relation]
    file = target.lstrip("/") if target.startswith("/") else "xl/" + target
    root = ET.fromstring(archive.read(file))
    cells = {}
    for cell in root.findall("s:sheetData/s:row/s:c", NS):
        if cell.find("s:f", NS) is not None:
            raise ValueError("Formula cells require separate review")
        value = cell.find("s:v", NS)
        text = value.text or "" if value is not None else ""
        if cell.attrib.get("t") == "s":
            text = strings[int(text)]
        elif cell.attrib.get("t") == "inlineStr":
            text = "".join(node.text or "" for node in cell.findall("s:is//s:t", NS))
        cells[cell.attrib["r"]] = text
    return cells


def convert(file):
    raw = file.read_bytes()
    with ZipFile(file) as archive:
        cells = read_sheet(archive, "意中人")
        mapping = read_sheet(archive, "赢家").get("A9", "")
    if "Easy Joy" not in mapping and "EasyJoy" not in mapping:
        raise ValueError("Workbook does not establish the Easy Joy sheet mapping")
    anchors = sorted(int(key[1:]) for key, value in cells.items() if re.fullmatch(r"B\d+", key) and (value.startswith("What ") or value.startswith("Where ") or value.startswith("纽约")))
    questions, history = [], []
    by_text = {}
    platform = None
    for i, row in enumerate(anchors):
        text = cells[f"B{row}"]
        raw_platform = cells.get(f"C{row}", "").strip().lower()
        if raw_platform:
            platform = {"chatgpt": "chatgpt", "gemini": "gemini", "deepseek": "deepseek", "豆包": "doubao"}.get(raw_platform)
            if platform is None:
                raise ValueError(f"Unrecognized platform at C{row}: {raw_platform}")
        if platform is None:
            raise ValueError(f"Missing platform at row {row}")
        if text not in by_text:
            question = {"id": f"easyjoy-discovery-{len(questions)+1:02}", "type": "discovery", "language": "zh" if text.startswith("纽约") else "en", "location": "New York City; exact area as worded in prompt", "text": text, "source_cells": []}
            by_text[text] = question
            questions.append(question)
        question = by_text[text]
        question["source_cells"].append(f"意中人!B{row}")
        end = min(anchors[i+1] - 1 if i+1 < len(anchors) else 141, 141)
        history.append({"question_id": question["id"], "platform": platform, "source_range": f"意中人!A{row}:G{end}", "reported_repeat": cells.get(f"D{row}", ""), "reported_presence": cells.get(f"E{row}", ""), "entries": [{"row": n, "reported_restaurant": cells.get(f"F{n}", ""), "source_links_text": cells.get(f"G{n}", "")} for n in range(row, end+1) if cells.get(f"F{n}") or cells.get(f"G{n}")], "evidence_status": "user_provided_conditions_unknown", "observed_at": None, "eligible_for_baseline": False})
    if len(questions) != 8 or len(history) != 32:
        raise ValueError(f"Expected 8 prompts and 32 historical observations, found {len(questions)}, {len(history)}")
    for name in ("chatgpt", "gemini", "deepseek", "doubao"):
        if len([item for item in history if item["platform"] == name]) != 8:
            raise ValueError(f"Expected 8 observations for {name}")
    supplements = [
        ("address", "What is the current street address of Easy Joy (意中人), the Mulberry Street restaurant in Chinatown, Manhattan, New York? Please cite the source and distinguish any similarly named locations."),
        ("hours", "What are the current opening hours of Easy Joy (意中人) on Mulberry Street in Chinatown, Manhattan, New York? Please cite the source and state if special holiday hours are unknown."),
        ("reservation", "How can I make a reservation at Easy Joy (意中人) on Mulberry Street in Chinatown, Manhattan, New York? Please provide the official reservation link if available, cite the source, and say if you cannot verify it."),
    ]
    questions.extend({"id": f"easyjoy-verify-{key}", "type": "brand_verification", "language": "en", "location": "Mulberry Street, Chinatown, Manhattan, New York", "text": text, "source_cells": [], "origin": "operator_approved_supplement_2026-10-14"} for key, text in supplements)
    return {"schema_version": "geo.question-bank.v1", "id": "easyjoy-final-20261014", "store_label": "Easy Joy · Mulberry St", "source": {"filename": file.name, "sha256": hashlib.sha256(raw).hexdigest(), "sheet": "意中人", "identity_mapping_cell": "赢家!A9"}, "questions": questions, "historical_observations": history, "limitations": ["Historical observations have unknown dates, account conditions and modes; excluded from current baseline.", "Source links are citations, not full original answers or conversation evidence.", "Original wording and languages retained, including dim sum-friendly."]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = convert(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"questions": len(result["questions"]), "historical_observations": len(result["historical_observations"]), "source_sha256": result["source"]["sha256"]}))
