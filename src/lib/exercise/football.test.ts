import { expect, it } from "vitest";
import { FOOTBALL } from "./football";
import { createObject } from "./model";

it("uses straight paths for dribble and removes goalkeeper tools from all teams", () => {
  expect(FOOTBALL.defaultPaths.dribble).toBe("straight");
  expect([...FOOTBALL.tools.flatMap(({ types }) => types), ...FOOTBALL.customTeamTools]
    .filter((type) => type.endsWith("goalkeeper"))).toEqual([]);
});

it("creates black coaches for both standard teams and custom teams", () => {
  for (const tool of ["team1-coach", "team2-coach", "custom-team-coach"] as const) {
    const customTeam = tool === "custom-team-coach" ? { number: 3, color: "#00ff00" } : undefined;
    expect(createObject(tool, { x: 100, y: 100 }, tool, customTeam).color).toBe("#000000");
  }
});
