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


bgm_files = get_files_in_folder("bgm")
template_files = get_files_in_folder("static/templates", extensions=[".html"])

data = {"bgm": bgm_files, "templates": template_files}

with open("files.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("files.json has been generated successfully.")
