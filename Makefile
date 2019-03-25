babel.js: src/fuzz_test.js src/fuzz.js
	browserify $< -o $@
