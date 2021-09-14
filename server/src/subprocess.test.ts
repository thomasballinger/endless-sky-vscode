import * as assert from "assert";
import {
  getExecutable,
  parsePluginWithSubprocess,
  TEMP_PLUGIN_NAME,
  withPreparedFilesystem,
} from "./subprocess";
import { readdirSync, existsSync, mkdirSync, rmdirSync, mkdtempSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Endless Sky and the filesystem", () => {
  let pluginDir = "";
  const filename = "ships.txt";
  const contents = `Ship Canoe\n\tdescription "small"`;

  before(() => {
    pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-"));
    fs.mkdirSync(path.join(pluginDir, "data"));
    fs.writeFileSync(path.join(pluginDir, "data", filename), contents);
  });

  after(() => {
    rmdirSync(pluginDir, { recursive: true });
  });

  it("can find an Endless Sky executable", () => {
    assert.strictEqual(!!getExecutable(), true);
  });

  describe("withPreparedFilesystem", () => {
    it("should have config dir when the function runs", async () => {
      const ret: number = await withPreparedFilesystem<number>(
        {},
        async ({ config }) => {
          assert.strictEqual(typeof config, "string");
          return 42;
        }
      );
      assert.strictEqual(ret, 42);
    });

    it("should have the plugin folder symlinked in", async () => {
      await withPreparedFilesystem({ pluginDir }, async ({ config }) => {
        const expected = path.join(config, "plugins", TEMP_PLUGIN_NAME);
        assert.strictEqual(existsSync(expected), true);
        const expectedDatafile = path.join(expected, "data", filename);
        assert.strictEqual(
          fs.readFileSync(expectedDatafile, { encoding: "utf8" }),
          contents
        );
      });
    });
  });

  describe("parseWithSubprocess", () => {
    it("should be able to read diagnostics", async () => {
      const output = await parsePluginWithSubprocess(pluginDir);
      assert.deepStrictEqual(output, [
        {
          file: path.join(pluginDir, "data", filename),
          linenos: [1],
          message: "Skipping unrecognized root object:",
        },
      ]);
    });
  });
});
