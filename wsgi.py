import sys
import os

# Add your project directory to the sys.path
project_home = '/home/sopnilali/youtube-downloader'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Add virtualenv if you're using one
# virtualenv_path = '/home/YOUR_USERNAME/.virtualenvs/ytdownloader/bin/activate_this.py'
# with open(virtualenv_path) as f:
#     exec(compile(f.read(), virtualenv_path, 'exec'), dict(__file__=virtualenv_path))

from app import app as application
