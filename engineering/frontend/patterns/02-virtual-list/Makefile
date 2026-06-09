.PHONY: run test

run: ts nodejs

ts:
	@echo "=== TypeScript ==="
	@cd skeleton/ts && npx ts-node main.ts

nodejs:
	@echo "=== Node.js (Browser Simulation) ==="
	@cd skeleton/nodejs && node index.js

test:
	@echo "=== Running tests ==="
	@cd skeleton/ts && npx ts-node test.ts