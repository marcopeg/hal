import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseConfigArg } from "./cli.js";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

const mockExistsSync = vi.mocked(existsSync);

describe("parseConfigArg", () => {
  beforeEach(() => {
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null) => {
        throw new Error("process.exit called");
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("directory mode: no extension → sets configDir, configFile undefined", () => {
    const result = parseConfigArg("./some/dir");
    expect(result.configDir).toBe(resolve(process.cwd(), "./some/dir"));
    expect(result.configFile).toBeUndefined();
  });

  it("equals-form: --config=./some/dir still resolves as directory mode", () => {
    const result = parseConfigArg("./some/dir");
    expect(result.configDir).toBe(resolve(process.cwd(), "./some/dir"));
    expect(result.configFile).toBeUndefined();
  });

  it("file mode: existing .json file → sets configDir to parent, configFile to basename", () => {
    mockExistsSync.mockReturnValue(true);
    const result = parseConfigArg("./some/dir/hal.config.json");
    expect(result.configDir).toBe(resolve(process.cwd(), "./some/dir"));
    expect(result.configFile).toBe("hal.config.json");
  });

  it("file mode: existing .yaml file → sets configDir and configFile", () => {
    mockExistsSync.mockReturnValue(true);
    const result = parseConfigArg("./configs/hal.config.yaml");
    expect(result.configDir).toBe(resolve(process.cwd(), "./configs"));
    expect(result.configFile).toBe("hal.config.yaml");
  });

  it("file mode: missing file → exits with error", () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => parseConfigArg("./missing/hal.config.json")).toThrow(
      "process.exit called",
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("config file not found"),
    );
  });

  it("unsupported extension → exits with error", () => {
    expect(() => parseConfigArg("./bad.xyz")).toThrow("process.exit called");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("unsupported config extension"),
    );
  });
});
