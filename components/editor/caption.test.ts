import { describe, expect, it } from "vitest";
import { captionOf } from "./caption";

describe("captionOf", () => {
  it("keeps words someone wrote", () => {
    expect(captionOf("Whiteboard after the design round")).toBe("Whiteboard after the design round");
    expect(captionOf("  architecture  ")).toBe("architecture");
  });

  it("drops filenames, generic words and placeholders", () => {
    for (const alt of ["", "image", "Screenshot", "board.png", "IMG_2041", "PXL_20261004_1", "Uploading image 3…", "photo.HEIC"]) {
      expect(captionOf(alt)).toBeNull();
    }
  });
});
