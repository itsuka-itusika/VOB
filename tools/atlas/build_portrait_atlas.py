#!/usr/bin/env python3
"""Build deterministic WebP portrait atlases and the runtime manifest."""

from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps


TILE_SIZE = 256
MAX_COLS = 8
MAX_ROWS = 8
MAX_TILES_PER_SHEET = MAX_COLS * MAX_ROWS
WEBP_QUALITY = 95

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = REPO_ROOT / "images" / "portraits"
ATLAS_ROOT = REPO_ROOT / "images" / "atlas"
MANIFEST_PATH = REPO_ROOT / "js" / "data" / "portraitAtlas.generated.js"

MISC_GROUPS = {"babies", "salt", "system", "wolf"}
SOURCE_ONLY_GROUPS = {"children", "sample"}


def natural_key(value: str) -> tuple[object, ...]:
    return tuple(int(part) if part.isdigit() else part.casefold()
                 for part in re.split(r"(\d+)", value))


def atlas_group(path: Path) -> str:
    top_level = path.relative_to(SOURCE_ROOT).parts[0]
    return "misc" if top_level in MISC_GROUPS else top_level


def source_sort_key(path: Path) -> tuple[object, ...]:
    relative = path.relative_to(SOURCE_ROOT)
    nested_folder = relative.parts[1] if len(relative.parts) > 2 else ""
    variant_rank = {"": 0, "old": 1, "young": 2}.get(nested_folder, 3)
    return (variant_rank, natural_key(relative.as_posix()))


def runtime_key(path: Path) -> str | None:
    relative = path.relative_to(SOURCE_ROOT)
    if relative.parts[0] in SOURCE_ONLY_GROUPS:
        return None
    return path.name


def prepare_tile(path: Path) -> tuple[Image.Image, bool]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        if image.size == (TILE_SIZE, TILE_SIZE):
            return image.copy(), False
        fitted = ImageOps.fit(
            image,
            (TILE_SIZE, TILE_SIZE),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        return fitted, True


def write_manifest(sheets: dict[str, dict[str, object]],
                   portrait_map: dict[str, dict[str, object]]) -> None:
    sheet_json = json.dumps(sheets, ensure_ascii=False, indent=2)
    map_json = json.dumps(portrait_map, ensure_ascii=False, indent=2)
    content = (
        "// build_portrait_atlas.py が生成。手で編集しない。\n"
        f"export const PORTRAIT_ATLAS_TILE = {TILE_SIZE};\n"
        f"export const PORTRAIT_ATLAS_SHEETS = {sheet_json};\n"
        f"export const PORTRAIT_ATLAS_MAP = {map_json};\n"
    )
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(content, encoding="utf-8", newline="\n")


def build() -> None:
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in SOURCE_ROOT.rglob("*.png"):
        groups[atlas_group(path)].append(path)

    if not groups:
        raise RuntimeError(f"PNG portrait not found: {SOURCE_ROOT}")

    ATLAS_ROOT.mkdir(parents=True, exist_ok=True)
    for old_sheet in ATLAS_ROOT.glob("*.webp"):
        old_sheet.unlink()

    sheets: dict[str, dict[str, object]] = {}
    portrait_map: dict[str, dict[str, object]] = {}
    resized_paths: list[Path] = []

    for group in sorted(groups, key=natural_key):
        sources = sorted(groups[group], key=source_sort_key)
        for sheet_offset in range(0, len(sources), MAX_TILES_PER_SHEET):
            chunk = sources[sheet_offset:sheet_offset + MAX_TILES_PER_SHEET]
            sheet_number = sheet_offset // MAX_TILES_PER_SHEET + 1
            sheet_id = f"{group}-{sheet_number}"
            cols = min(MAX_COLS, len(chunk))
            rows = math.ceil(len(chunk) / cols)
            sheet = Image.new("RGBA", (cols * TILE_SIZE, rows * TILE_SIZE), (0, 0, 0, 0))

            for index, source_path in enumerate(chunk):
                col = index % cols
                row = index // cols
                tile, resized = prepare_tile(source_path)
                sheet.alpha_composite(tile, (col * TILE_SIZE, row * TILE_SIZE))
                if resized:
                    resized_paths.append(source_path)

                key = runtime_key(source_path)
                if key is None:
                    continue
                if key in portrait_map:
                    first = portrait_map[key].get("source", "unknown")
                    raise RuntimeError(f"Duplicate runtime key {key}: {first}, {source_path}")
                portrait_map[key] = {
                    "sheet": sheet_id,
                    "col": col,
                    "row": row,
                    "source": source_path.relative_to(REPO_ROOT).as_posix(),
                }

            output_path = ATLAS_ROOT / f"{sheet_id}.webp"
            sheet.save(
                output_path,
                "WEBP",
                quality=WEBP_QUALITY,
                method=6,
                exact=True,
            )
            sheets[sheet_id] = {
                "url": output_path.relative_to(REPO_ROOT).as_posix(),
                "cols": cols,
                "rows": rows,
            }

    for entry in portrait_map.values():
        entry.pop("source", None)
    write_manifest(sheets, portrait_map)

    sheet_paths = sorted(ATLAS_ROOT.glob("*.webp"))
    total_bytes = sum(path.stat().st_size for path in sheet_paths)
    source_count = sum(len(paths) for paths in groups.values())
    print(f"Portraits: {source_count}")
    print(f"Runtime map entries: {len(portrait_map)}")
    print(f"Atlas sheets: {len(sheet_paths)}")
    print(f"Atlas size: {total_bytes / 1024 / 1024:.2f} MiB")
    if resized_paths:
        print("Center-cropped/resized sources:")
        for path in resized_paths:
            print(f"  {path.relative_to(REPO_ROOT).as_posix()}")


if __name__ == "__main__":
    build()
