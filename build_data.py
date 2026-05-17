#!/usr/bin/env python3
"""Regenerate data/*.js from the JSON sources.

Run this after editing gameflow.json, hotspots.json, or src/voice_manifest.json
so that index.html (which loads data via <script src>) picks up the changes
when opened via file://.
"""
import json
import pathlib

root = pathlib.Path(__file__).parent
out = root / "data"
out.mkdir(exist_ok=True)

def write_js(varname, src_path, dst_path, note=""):
    data = json.load(open(src_path, encoding="utf-8"))
    js = (
        f"// AUTO-GENERATED from {src_path}. {note}\n"
        f"window.{varname} = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n"
    )
    open(dst_path, "w", encoding="utf-8").write(js)
    print(f"  wrote {dst_path}  ({len(js):,} bytes)")

print("Building data/*.js …")
write_js("GAMEFLOW", root/"gameflow.json", out/"gameflow.js")
write_js("HOTSPOTS", root/"hotspots.json", out/"hotspots.js",
         "Use H toggle in the running game to verify positions, then edit hotspots.json and re-run this script.")
write_js("VOICE_MANIFEST", root/"src"/"voice_manifest.json", out/"voice_manifest.js")
print("Done.")
