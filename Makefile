all: babel.js

babel.js: src/babel.js
	npx browserify $< -o $@

.PHONY: clean
clean:
	rm -f babel.js
