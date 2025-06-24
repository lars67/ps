import json
import re

def extract_commands_from_json_value(json_string):
    commands = set()
    command_pattern = re.compile(r'"command":"([^"]+)"')
    matches = command_pattern.findall(json_string)
    for cmd in matches:
        commands.add(cmd)
    return commands

def extract_commands_from_ps2_commands_json(file_path):
    commands = set()
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for item in data:
                if "value" in item and isinstance(item["value"], str):
                    unescaped_value = item["value"].replace('\\"', '"')
                    commands.update(extract_commands_from_json_value(unescaped_value))
    except FileNotFoundError:
        print(f"Error: {file_path} not found.")
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON from {file_path}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred with {file_path}: {e}")
    return commands

def extract_commands_from_markdown(markdown_content, is_commands_overview=False):
    commands = set()
    if is_commands_overview:
        # For commands_overview.md, commands are top-level headings
        command_pattern = re.compile(r'^## `([^`]+)`', re.MULTILINE)
        matches = command_pattern.findall(markdown_content)
        for cmd in matches:
            commands.add(cmd.strip())
    else:
        # For PS2_API_Manual.md, look for commands in JSON blocks and cmd fields
        command_pattern = re.compile(r'"command":\s*"([^"]+)"')
        old_command_pattern = re.compile(r'"cmd":"([^"]+)"')
        for line in markdown_content.splitlines():
            commands.update(command_pattern.findall(line))
            commands.update(old_command_pattern.findall(line))
    return commands

if __name__ == "__main__":
    ps2_commands_json_path = "PS2/ps2.commands.json"
    ps2_api_manual_md_path = "PS2/PS2_API_Manual.md"
    commands_overview_md_path = "commands_overview.md"

    all_source_commands = set()

    # Extract commands from PS2/ps2.commands.json
    all_source_commands.update(extract_commands_from_ps2_commands_json(ps2_commands_json_path))

    # Extract commands from PS2/PS2_API_Manual.md
    try:
        with open(ps2_api_manual_md_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
            all_source_commands.update(extract_commands_from_markdown(markdown_content, is_commands_overview=False))
    except FileNotFoundError:
        print(f"Error: {ps2_api_manual_md_path} not found.")
    except Exception as e:
        print(f"An unexpected error occurred with {ps2_api_manual_md_path}: {e}")

    # Extract commands from commands_overview.md
    documented_commands = set()
    try:
        with open(commands_overview_md_path, 'r', encoding='utf-8') as f:
            commands_overview_content = f.read()
            documented_commands.update(extract_commands_from_markdown(commands_overview_content, is_commands_overview=True))
    except FileNotFoundError:
        print(f"Error: {commands_overview_md_path} not found.")
    except Exception as e:
        print(f"An unexpected error occurred with {commands_overview_md_path}: {e}")

    missing_commands = sorted(list(all_source_commands - documented_commands))
    if missing_commands:
        print("\nCommands found in source files but missing from commands_overview.md:")
        for cmd in missing_commands:
            print(cmd)
    else:
        print("\nAll commands from source files are present in commands_overview.md.")

    print("\nUnique Commands found across all source files:")
    for cmd in sorted(list(all_source_commands)):
        print(cmd)