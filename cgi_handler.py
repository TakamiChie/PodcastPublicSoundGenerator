#!/usr/local/bin/python3.8
# -*- coding: utf-8 -*-
"""さくらインターネットでCGI実行するためのエントリーポイント"""

from wsgiref.handlers import CGIHandler
from app import app

CGIHandler().run(app)
