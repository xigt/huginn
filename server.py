
from __future__ import print_function

import os
import tempfile

from flask import Flask, request, render_template #, url_for

from xigt.importers import toolbox as toolbox_import

app = Flask(__name__)

@app.route("/", methods=['POST', 'GET'])
def upload(name=None, methods=['POST', 'GET']):
    print(request.method)
    temp_save_file = tempfile.mkstemp()
    temp_upload_file = tempfile.mkstemp()
    if request.method == 'POST':
        print_json(request.get_json())
        os.write(temp_upload_file[0], request.get_json()["file"])
        toolbox_import.xigt_import(temp_upload_file[1], temp_save_file[1], options=None)
    return render_template("upload.html")

def print_json(json_file, indent=0):
    for category in json_file:
        tab = "\t" * indent
        print("%s%s\n" % (tab, category))
        if type(json_file[category]) is dict:
            print_json(json_file[category], indent + 1)
        else:
            for line in json_file[category].split("\n"):
                print("\t%s%s" % (tab, line))


if __name__ == "__main__":
    app.run(debug=True)
