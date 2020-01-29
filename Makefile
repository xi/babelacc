all: babel.js fuzz.js

babel.js: src/babel.js src/axs.js
	browserify $< -o $@

fuzz.js: fuzz/index.js fuzz/*.js node_modules/aria-api/instrumented.js node_modules/aria-api/lib/name-inst.js
	browserify $< -o $@

node_modules/aria-api/instrumented.js: node_modules/aria-api/index.js
	cat $< | sed 's/name\.js/name-inst\.js/' > $@

node_modules/aria-api/lib/name-inst.js: node_modules/aria-api/lib/name.js
	npx nyc instrument $< > $@
