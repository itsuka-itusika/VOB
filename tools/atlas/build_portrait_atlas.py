#!/usr/bin/env python3
"""Build deterministic WebP portrait atlases and the runtime manifest."""

from __future__ import annotations

import argparse
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


def read_manifest() -> tuple[dict, dict]:
    content = MANIFEST_PATH.read_text(encoding="utf-8")
    sheets = re.search(r"export const PORTRAIT_ATLAS_SHEETS = (\{.*?\});", content, re.S)
    portraits = re.search(r"export const PORTRAIT_ATLAS_MAP = (\{.*?\});", content, re.S)
    if not sheets or not portraits:
        raise RuntimeError(f"Invalid atlas manifest: {MANIFEST_PATH}")
    return json.loads(sheets[1]), json.loads(portraits[1])


def update_groups(selected_groups: list[str]) -> None:
    """Update selected groups, keeping existing IDs, tile positions and other sheets."""
    sheets, portraits = read_manifest()
    outputs: dict[Path, Image.Image] = {}
    for group in dict.fromkeys(selected_groups):
        if not re.fullmatch(r"[A-Za-z0-9_]+", group):
            raise ValueError(f"Invalid portrait group: {group}")
        source_folder = SOURCE_ROOT / group
        sources = sorted(source_folder.rglob("*.png"), key=source_sort_key)
        if not sources or group in SOURCE_ONLY_GROUPS or group in MISC_GROUPS:
            raise ValueError(f"No updatable portrait sources: {source_folder}")
        sheet_pattern = re.compile(rf"^{re.escape(group)}-(\d+)$")
        group_sheets = {key: value for key, value in sheets.items() if sheet_pattern.fullmatch(key)}
        cols = next(iter(group_sheets.values()))["cols"] if group_sheets else min(MAX_COLS, len(sources))
        if any(sheet["cols"] != cols for sheet in group_sheets.values()):
            raise RuntimeError(f"Mixed column counts in group: {group}")
        capacity = cols * MAX_ROWS
        tiles: dict[int, Image.Image] = {}
        positions: dict[str, int] = {}
        for sheet_id, metadata in group_sheets.items():
            sheet_number = int(sheet_pattern.fullmatch(sheet_id)[1])
            with Image.open(REPO_ROOT / metadata["url"]) as source:
                sheet_image = source.convert("RGBA")
            for key, entry in portraits.items():
                if entry["sheet"] != sheet_id:
                    continue
                col, row = entry["col"], entry["row"]
                index = (sheet_number - 1) * capacity + row * cols + col
                if index in tiles:
                    raise RuntimeError(f"Duplicate atlas slot: {sheet_id}/{col}/{row}")
                positions[key] = index
                tiles[index] = sheet_image.crop((col * TILE_SIZE, row * TILE_SIZE,
                                                 (col + 1) * TILE_SIZE, (row + 1) * TILE_SIZE))
        next_index = max(tiles, default=-1) + 1
        seen_keys: set[str] = set()
        for path in sources:
            key = runtime_key(path)
            if key is None or key in seen_keys:
                raise RuntimeError(f"Duplicate or invalid portrait key: {path}")
            seen_keys.add(key)
            if key in portraits and key not in positions:
                raise RuntimeError(f"Portrait key belongs to another group: {key}")
            with Image.open(path) as source:
                if source.size != (TILE_SIZE, TILE_SIZE):
                    raise ValueError(f"Incremental source must be 256x256: {path}")
                tile = source.convert("RGBA")
            if key not in positions:
                positions[key] = next_index
                next_index += 1
            tiles[positions[key]] = tile
        for sheet_offset in range(math.ceil(next_index / capacity)):
            chunk = {index % capacity: tile for index, tile in tiles.items()
                     if index // capacity == sheet_offset}
            if not chunk:
                continue
            rows = max(chunk) // cols + 1
            canvas = Image.new("RGBA", (cols * TILE_SIZE, rows * TILE_SIZE), (0, 0, 0, 0))
            for index, tile in chunk.items():
                canvas.paste(tile, ((index % cols) * TILE_SIZE, (index // cols) * TILE_SIZE))
            sheet_id = f"{group}-{sheet_offset + 1}"
            output = ATLAS_ROOT / f"{sheet_id}.webp"
            outputs[output] = canvas
            sheets[sheet_id] = {"url": output.relative_to(REPO_ROOT).as_posix(), "cols": cols, "rows": rows}
        for key, index in positions.items():
            portraits[key] = {"sheet": f"{group}-{index // capacity + 1}",
                              "col": index % cols, "row": (index % capacity) // cols}
        print(f"{group}: {len(positions)} portraits")
    # Lossless encoding preserves decoded pixels of existing tiles when extending a sheet.
    for path, canvas in outputs.items():
        canvas.save(path, "WEBP", lossless=True, method=6, exact=True)
    write_manifest(sheets, portraits)
    print(f"Updated atlas sheets: {len(outputs)}; runtime entries: {len(portraits)}")


def build() -> None:
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in SOURCE_ROOT.rglob("*.png"):
        groups[atlas_group(path)].append(path)

    if not groups:
        raise RuntimeError(f"PNG portrait not found: {SOURCE_ROOT}")

    if MANIFEST_PATH.exists():
        _, existing_portraits = read_manifest()
        available_keys = {runtime_key(path) for sources in groups.values() for path in sources}
        missing_keys = existing_portraits.keys() - available_keys
        if missing_keys:
            raise RuntimeError("Full rebuild requires every original PNG. "
                               "Use --groups to update selected groups while preserving existing atlases.")

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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--groups", nargs="+", help="Update only these source folders, preserving existing tiles")
    args = parser.parse_args()
    if args.groups:
        update_groups(args.groups)
    else:
        build()
