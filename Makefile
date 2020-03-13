NPM_BIN = $(shell npm bin)

node_modules:
	npm ci

.PHONY: run
run: node_modules
	$(NPM_BIN)/pm2 start index.js --max-memory-restart 100M

.PHONY: status
status: node_modules
	$(NPM_BIN)/pm2 status

.PHONY: stop
stop: node_modules
	$(NPM_BIN)/pm2 kill

