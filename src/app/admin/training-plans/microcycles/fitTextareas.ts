type Area = { scrollHeight: number; offsetHeight: number; clientHeight: number; style: { height: string } };

/**
 * Sets the height of each text field in a training to the height of its text.
 * With `even`, all fields of the training get the height of the tallest field, so the table row stays even.
 * The function first resets all heights and then reads them, so the browser calculates the layout only one time.
 */
export function fitTextareas(rows: Area[][], even: boolean) {
  for (const row of rows) for (const area of row) area.style.height = "auto";
  const heights = rows.map((row) => row.map((area) => area.scrollHeight + area.offsetHeight - area.clientHeight));
  rows.forEach((row, index) => {
    const tallest = Math.max(...heights[index]);
    row.forEach((area, column) => { area.style.height = `${even ? tallest : heights[index][column]}px`; });
  });
}
