import os
import json
import sys


def get_files_in_folder(folder_path, extensions=None):
    files = []
    if os.path.exists(folder_path):
        for file in os.listdir(folder_path):
            if (
                os.path.isfile(os.path.join(folder_path, file))
                and not file.startswith(".")
                and file != "README.md"
            ):
                if extensions is None or any(file.endswith(ext) for ext in extensions):
                    files.append(file)
    return files


def get_files_recursively(folder_path, extensions=None):
    files = []
    if os.path.exists(folder_path):
        for root, dirs, filenames in os.walk(folder_path):
            for file in filenames:
                if (
                    not file.startswith(".")
                    and file != "README.md"
                ):
                    if extensions is None or any(file.endswith(ext) for ext in extensions):
                        # 相対パスを保存（フォワードスラッシュで統一）
                        full_path = os.path.join(root, file)
                        relative_path = os.path.relpath(full_path, folder_path)
                        # Windowsのバックスラッシュをフォワードスラッシュに変換
                        relative_path = relative_path.replace("\\", "/")
                        files.append(relative_path)
    return files


bgm_files = get_files_recursively("bgm", extensions=[".mp3", ".wav"])
template_files = get_files_in_folder("static/templates", extensions=[".html"])

data = {"bgm": bgm_files, "templates": template_files}
with open("files.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("files.json has been generated successfully.")
