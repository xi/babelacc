babel.js: src/babel.js src/axs.js src/eval.patch
	browserify $< -o $@
	patch $@ src/eval.patch
