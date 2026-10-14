import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProbabilityBoard } from "../../web/src/components/ProbabilityBoard.js";
import { computeProbabilities } from "../src/engines/probability.js";

test("probability interface renders abstentions without unsupported percentages", async () => {
  const probabilities = await computeProbabilities({ quotes: {}, clusters: [] }, {
    now: new Date("2026-10-14T12:00:00Z"), marketLookup: async () => ({ prob: null }),
  });
  const html = renderToStaticMarkup(React.createElement(ProbabilityBoard, { probabilities }));
  assert.match(html, /Probability Research/);
  assert.equal((html.match(/forecast withheld/g) ?? []).length, 7);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /Mispricing Radar|15%|18%|33%/);
  assert.match(renderToStaticMarkup(React.createElement(ProbabilityBoard, { probabilities: [] })), /not yet available/);
});
