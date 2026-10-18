#!/usr/bin/env python3
"""Keep the maintainer command aligned with the independently installable skill."""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parents[1] / 'assets' / 'creator-skill' / 'playpets-creator' / 'scripts' / 'creator-workflow.py'), run_name='__main__')
