import os
import re

from flask import current_app

_BARE = re.compile(r"^[A-Za-z0-9]{1,64}\.[A-Za-z0-9]{1,8}$")


class FileStore:
    def __init__(self, subdir):
        self.subdir = subdir

    def _dir(self):
        return os.path.join(current_app.config["UPLOAD_DIR"], self.subdir)

    def path(self, name):
        if not _BARE.fullmatch(name or ""):
            raise ValueError("not a stored file name")
        return os.path.join(self._dir(), name)

    def save(self, name, data):
        os.makedirs(self._dir(), exist_ok=True)
        with open(self.path(name), "wb") as handle:
            handle.write(data)

    def delete(self, name):
        try:
            os.remove(self.path(name))
            return True
        except (OSError, ValueError):
            return False
