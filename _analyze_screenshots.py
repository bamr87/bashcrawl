#!/usr/bin/env python3
"""Analyze screenshot directories for categorization planning."""
import ast
import os
import collections

# Phase 1: Build test_name -> module mapping from source
module_tests = {}
for root, dirs, files in os.walk('test'):
    dirs[:] = [d for d in dirs if d != '__pycache__']
    for f in files:
        if f.startswith('test_') and f.endswith('.py'):
            path = os.path.join(root, f)
            with open(path) as fh:
                try:
                    tree = ast.parse(fh.read())
                except Exception:
                    continue
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name.startswith('test_'):
                    module_tests[node.name] = path.replace('test/', '')

# Phase 2: Map screenshot dirs to modules
screenshots = sorted(os.listdir('logs/screenshots'))
module_cats = collections.Counter()
file_cats = collections.Counter()
for d in screenshots:
    parts = d.split('_', 2)
    tname = parts[2] if len(parts) >= 3 else d
    mod = module_tests.get(tname, 'unknown')
    cat = os.path.dirname(mod) if '/' in mod else 'root'
    module_cats[cat] += 1
    file_cats[mod] += 1

print('=== Module-based categories (by dir) ===')
for k, v in module_cats.most_common():
    print(f'  {k}: {v}')

print()
print('=== Module file-based categories ===')
for k, v in file_cats.most_common():
    print(f'  {k}: {v}')
