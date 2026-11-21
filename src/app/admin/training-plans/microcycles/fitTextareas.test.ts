import { expect, it } from "vitest";
import { fitTextareas } from "./fitTextareas";

const area = (text: number) => ({ scrollHeight: text, offsetHeight: 60, clientHeight: 58, style: { height: "150px" } });

it("gives each field the height of its text and the border", () => {
  const row = [area(40), area(100)];
  fitTextareas([row], false);
  expect(row.map((item) => item.style.height)).toEqual(["42px", "102px"]);
});

it("gives all fields of a training the height of the tallest field", () => {
  const first = [area(40), area(100), area(70)];
  const second = [area(30), area(30)];
  fitTextareas([first, second], true);
  expect(first.map((item) => item.style.height)).toEqual(["102px", "102px", "102px"]);
  expect(second.map((item) => item.style.height)).toEqual(["32px", "32px"]);
});
