babel.js: src/babel.js lib/*.js
	browserify $< -o $@
