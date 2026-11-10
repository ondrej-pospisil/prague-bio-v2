# Prague.bio – nejčastější příkazy
PY = .venv/bin/python

.PHONY: setup dev build check clean

setup:   ## jednorázově: venv, závislosti, Tailwind CLI
	sh tools/setup.sh

dev:     ## build + náhled na http://localhost:8791
	sh tools/dev.sh

build:   ## produkční build do public/ (včetně kontroly a předkomprese)
	$(PY) tools/build.py

check:   ## kontrola odkazů, SEO a přístupnosti hotového public/
	$(PY) tools/check.py

clean:   ## smaže public/
	rm -rf public
