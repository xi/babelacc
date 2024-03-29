all: babel.js fuzz.js

babel.js: src/babel.js src/axs.js
	npx browserify $< -o $@

fuzz.js: fuzz/index.js fuzz/*.js node_modules/aria-api/instrumented.js node_modules/aria-api/lib/name-inst.js
	npx browserify $< -o $@

node_modules/aria-api/instrumented.js: node_modules/aria-api/index.js
	cat $< | sed 's/name\.js/name-inst\.js/' > $@

node_modules/aria-api/lib/name-inst.js: node_modules/aria-api/lib/name.js
	npx nyc instrument $< | sed 's/path="[^"]*\/node_modules/path="node_modules/' > $@

.PHONY: clean
clean:
	rm -f babel.js fuzz.js node_modules/aria-api/instrumented.js node_modules/aria-api/lib/name-inst.js
