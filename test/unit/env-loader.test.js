import { describe, it, expect } from 'vitest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

describe('env-loader', () => {
  describe('environment loading', () => {
    it('should attempt to load .env file without throwing', () => {
      // The env-loader runs automatically on import
      // This test verifies dotenv works as expected
      expect(() => dotenv.config()).not.toThrow();
    });

    it('should handle missing .env file gracefully', () => {
      // dotenv.config returns error if .env doesn't exist
      const result = dotenv.config({ path: '/nonexistent/path/.env' });
      expect(result.parsed).toEqual({});
      expect(result.error).toBeDefined(); // Error when file not found
    });

    it('should load variables from a valid .env file', () => {
      // Create a temporary .env file
      const testEnvPath = path.join(process.cwd(), '.env.test');
      fs.writeFileSync(testEnvPath, 'TEST_VAR=hello\nTEST_KEY=world');

      const result = dotenv.config({ path: testEnvPath });
      expect(result.parsed).toEqual({ TEST_VAR: 'hello', TEST_KEY: 'world' });

      // Cleanup
      fs.unlinkSync(testEnvPath);
    });
  });
});
