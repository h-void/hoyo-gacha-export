import argparse
import json
from pathlib import Path
import requests
from opencc import OpenCC

REPO_ROOT = Path(__file__).resolve().parent.parent
cc = OpenCC("s2t")

LANGUAGE_MAP = {
    "zh-cn": "zh",
    "zh-tw": "zh",
    "en-us": "en",
    "ja-jp": "ja",
    "ko-kr": "ko",
}

HSR_TYPE_MAP = {
    "weapon": {
        "zh-cn": "光锥",
        "zh-tw": "光錐",
        "en-us": "Light Cone",
        "ja-jp": "光円錐",
        "ko-kr": "무기",
    },
    "character": {
        "zh-cn": "角色",
        "zh-tw": "角色",
        "en-us": "Character",
        "ja-jp": "キャラ",
        "ko-kr": "캐릭터",
    },
}

ZZZ_TYPE_MAP = {
    "weapon": {
        "zh-cn": "音擎",
        "zh-tw": "音擎",
        "en-us": "W-Engines",
        "ja-jp": "音動機",
        "ko-kr": "W-엔진",
    },
    "character": {
        "zh-cn": "代理人",
        "zh-tw": "代理人",
        "en-us": "Agents",
        "ja-jp": "エージェント",
        "ko-kr": "에이전트",
    },
    "bangboo": {
        "zh-cn": "邦布",
        "zh-tw": "邦布",
        "en-us": "Bangboo",
        "ja-jp": "ボンプ",
        "ko-kr": "「Bangboo」",
    },
}


def fetch_json(url):
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    return response.json()


def transform_data(data, item_type, type_map, extract_rank):
    transformed = {lang: {} for lang in LANGUAGE_MAP}
    for item_id, item in data.items():
        for lang, key in LANGUAGE_MAP.items():
            raw_name = item.get("zh", "") if lang == "zh-tw" else item.get(key, "")
            name = cc.convert(raw_name) if lang == "zh-tw" else raw_name
            transformed[lang][item_id] = {
                "name": name,
                "item_type": type_map[item_type][lang],
                "rank_type": extract_rank(item),
            }
    return transformed


def update_starrail(manifest):
    latest_version = manifest["hsr"]["live"]
    print(f"[starrail] Latest version: {latest_version}")

    weapon_data = fetch_json(f"https://static.nanoka.cc/hsr/{latest_version}/lightcone.json")
    character_data = fetch_json(f"https://static.nanoka.cc/hsr/{latest_version}/character.json")
    print(f"[starrail] Fetched {len(weapon_data)} lightcones, {len(character_data)} characters")

    out_data = {lang: {} for lang in LANGUAGE_MAP}
    out_data["version"] = latest_version

    weapon_transformed = transform_data(weapon_data, "weapon", HSR_TYPE_MAP, lambda item: str(item["rank"])[-1])
    character_transformed = transform_data(character_data, "character", HSR_TYPE_MAP, lambda item: str(item["rank"])[-1])

    for lang in LANGUAGE_MAP:
        out_data[lang].update(weapon_transformed[lang])
        out_data[lang].update(character_transformed[lang])

    target = REPO_ROOT / "src" / "games" / "starrail" / "idJson.json"
    with target.open("w", encoding="utf-8") as f:
        json.dump(out_data, f, ensure_ascii=False, indent=2)
    print(f"[starrail] Updated {target}")


def update_zzz(manifest):
    latest_version = manifest["zzz"]["live"]
    print(f"[zzz] Latest version: {latest_version}")

    weapon_data = fetch_json(f"https://static.nanoka.cc/zzz/{latest_version}/weapon.json")
    character_data = fetch_json(f"https://static.nanoka.cc/zzz/{latest_version}/character.json")
    bangboo_data = fetch_json(f"https://static.nanoka.cc/zzz/{latest_version}/bangboo.json")
    print(
        f"[zzz] Fetched {len(weapon_data)} weapons, "
        f"{len(character_data)} characters, {len(bangboo_data)} bangboos"
    )

    out_data = {lang: {} for lang in LANGUAGE_MAP}
    out_data["version"] = latest_version

    weapon_transformed = transform_data(weapon_data, "weapon", ZZZ_TYPE_MAP, lambda item: item["rank"])
    character_transformed = transform_data(character_data, "character", ZZZ_TYPE_MAP, lambda item: item["rank"])
    bangboo_transformed = transform_data(bangboo_data, "bangboo", ZZZ_TYPE_MAP, lambda item: item["rank"])

    for lang in LANGUAGE_MAP:
        out_data[lang].update(weapon_transformed[lang])
        out_data[lang].update(character_transformed[lang])
        out_data[lang].update(bangboo_transformed[lang])

    target = REPO_ROOT / "src" / "games" / "zzz" / "idJson.json"
    with target.open("w", encoding="utf-8") as f:
        json.dump(out_data, f, ensure_ascii=False, indent=2)
    print(f"[zzz] Updated {target}")


def main():
    parser = argparse.ArgumentParser(description="Update Star Rail and Zenless Zone Zero item ID maps")
    parser.add_argument(
        "--game",
        choices=["all", "starrail", "zzz"],
        default="all",
        help="Target game ID map to update",
    )
    args = parser.parse_args()

    manifest = fetch_json("https://static.nanoka.cc/manifest.json")
    if args.game in ("all", "starrail"):
        update_starrail(manifest)
    if args.game in ("all", "zzz"):
        update_zzz(manifest)


if __name__ == "__main__":
    main()
