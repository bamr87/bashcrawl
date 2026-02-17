"""Demo walkthrough test module for Bashcrawl.

Provides a framework for running scripted game playthroughs via real bash
subprocesses, capturing every command's input and output as structured
snapshots, and rendering the results into comprehensive Markdown
documentation.

Usage::

    # Run the demo test (generates docs/demo-walkthrough.md)
    pytest -m demo -v --timeout=120

    # Run with verbose output
    pytest -m demo -v -s --timeout=120
"""
