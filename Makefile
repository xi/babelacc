babel.js: src/babel.js src/axs.js
	browserify $< -o $@
