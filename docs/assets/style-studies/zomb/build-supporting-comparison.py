"""Rebuild the complete cast gallery from canonical modular character dossiers.

This legacy command now delegates to the current gallery instead of rewriting
character sheets or recreating obsolete asset locations.
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).resolve().parent / 'regenerated-v2/build-gallery.py'), run_name='__main__')
