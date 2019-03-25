babel.js: src/babel.js src/axs.js src/eval.patch
	browserify $< -o $@
	patch $@ src/eval.patch

node_modules/aria-api/instrumented.js: node_modules/aria-api/index.js
	cat $< | sed 's/name\.js/name-inst\.js/' > $@

node_modules/aria-api/lib/name-inst.js: node_modules/aria-api/lib/name.js
	npx nyc instrument $< > $@
