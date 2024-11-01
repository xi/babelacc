all: babel.js

babel.js: src/babel.js src/axs.js
	npx browserify $< -o $@

.PHONY: clean
clean:
	rm -f babel.js
