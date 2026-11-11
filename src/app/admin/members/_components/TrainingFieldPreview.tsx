export function getFieldBackground(fieldType: string): string {
  switch (fieldType) {
    case "basketball":
      return "#c17a32";
    case "tennis":
      return "#2e6b9e";
    case "volleyball":
      return "#e07a50";
    case "boxing":
      return "#1a6b9e";
    case "karate":
      return "#e8919f";
    case "swimming":
      return "linear-gradient(180deg, #0e5fb5 0%, #1878d4 45%, #1060b8 100%)";
    default:
      return "linear-gradient(90deg, rgba(32,142,50,0.82) 0 12.5%, rgba(26,122,43,0.82) 12.5% 25%, rgba(32,142,50,0.82) 25% 37.5%, rgba(26,122,43,0.82) 37.5% 50%, rgba(32,142,50,0.82) 50% 62.5%, rgba(26,122,43,0.82) 62.5% 75%, rgba(32,142,50,0.82) 75% 87.5%, rgba(26,122,43,0.82) 87.5% 100%)";
  }
}

export function clubSportToFieldType(sport: string): string {
  const s = sport.toLowerCase();
  if (/basket|баскетбол/.test(s)) return "basketball";
  if (/tenis|тенис/.test(s)) return "tennis";
  if (/voley|волей/.test(s)) return "volleyball";
  if (/box|бокс/.test(s)) return "boxing";
  if (/karat|karate|карате|taekwon|таекуондо|judo|джудо/.test(s)) return "karate";
  if (/swim|плув|басейн/.test(s)) return "swimming";
  return "football";
}

export function renderFieldMarkings(fieldType: string) {
  const line = "rgba(255,255,255,0.82)";
  switch (fieldType) {
    case "basketball":
      return (
        <>
          {/* outer border */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "8px",
              border: `1px solid ${line}`,
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* center line */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "50%",
              width: "1px",
              background: line,
              transform: "translateX(-0.5px)",
              pointerEvents: "none",
            }}
          />
          {/* center circle */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "26px",
              height: "26px",
              border: `1px solid ${line}`,
              borderRadius: "999px",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
          {/* center dot */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "4px",
              height: "4px",
              background: "rgba(255,255,255,0.9)",
              borderRadius: "999px",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
          {/* left key rectangle */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "22%",
              bottom: "22%",
              left: "8px",
              width: "19%",
              border: `1px solid ${line}`,
              borderRight: "none",
              pointerEvents: "none",
            }}
          />
          {/* left free-throw semi-circle */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "22%",
              bottom: "22%",
              left: "calc(8px + 19%)",
              width: "9%",
              borderTop: `1px solid ${line}`,
              borderRight: `1px solid ${line}`,
              borderBottom: `1px solid ${line}`,
              borderRadius: "0 999px 999px 0",
              pointerEvents: "none",
            }}
          />
          {/* right key rectangle */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "22%",
              bottom: "22%",
              right: "8px",
              width: "19%",
              border: `1px solid ${line}`,
              borderLeft: "none",
              pointerEvents: "none",
            }}
          />
          {/* right free-throw semi-circle */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "22%",
              bottom: "22%",
              right: "calc(8px + 19%)",
              width: "9%",
              borderTop: `1px solid ${line}`,
              borderLeft: `1px solid ${line}`,
              borderBottom: `1px solid ${line}`,
              borderRadius: "999px 0 0 999px",
              pointerEvents: "none",
            }}
          />
        </>
      );
    case "tennis":
      return (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "8px",
              border: `1px solid ${line}`,
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "50%",
              width: "2px",
              background: "rgba(255,255,255,0.9)",
              transform: "translateX(-1px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "35%",
              width: "1px",
              background: line,
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              right: "35%",
              width: "1px",
              background: line,
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: "35%",
              width: "15%",
              height: "1px",
              background: line,
              transform: "translateY(-0.5px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              right: "35%",
              width: "15%",
              height: "1px",
              background: line,
              transform: "translateY(-0.5px)",
              pointerEvents: "none",
            }}
          />
        </>
      );
    case "volleyball":
      return (
        <>
          {/* outer border */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "8px",
              border: `2px solid ${line}`,
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* net band with mesh */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "calc(50% - 5px)",
              width: "10px",
              borderLeft: "1px solid rgba(255,255,255,0.95)",
              borderRight: "1px solid rgba(255,255,255,0.95)",
              background:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 1px, transparent 1px, transparent 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 1px, transparent 1px, transparent 4px)",
              pointerEvents: "none",
            }}
          />
          {/* antenna top */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "2px",
              left: "50%",
              width: "2px",
              height: "6px",
              background: "rgba(255,255,255,0.7)",
              transform: "translateX(-1px)",
              pointerEvents: "none",
            }}
          />
          {/* antenna bottom */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "2px",
              left: "50%",
              width: "2px",
              height: "6px",
              background: "rgba(255,255,255,0.7)",
              transform: "translateX(-1px)",
              pointerEvents: "none",
            }}
          />
          {/* left attack line */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "33%",
              width: "1px",
              background: line,
              pointerEvents: "none",
            }}
          />
          {/* right attack line */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              right: "33%",
              width: "1px",
              background: line,
              pointerEvents: "none",
            }}
          />
        </>
      );
    case "boxing":
      return (
        <>
          {/* outer rope */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "5px",
              border: "2px solid rgba(255,255,255,0.9)",
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* inner rope (dashed) */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "12px",
              border: "1px dashed rgba(255,255,255,0.65)",
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* corner post top-left */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "3px",
              left: "3px",
              width: "6px",
              height: "6px",
              background: "rgba(20,20,20,0.9)",
              borderRadius: "999px",
              pointerEvents: "none",
            }}
          />
          {/* corner post top-right */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "3px",
              right: "3px",
              width: "6px",
              height: "6px",
              background: "rgba(20,20,20,0.9)",
              borderRadius: "999px",
              pointerEvents: "none",
            }}
          />
          {/* corner post bottom-left */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "3px",
              left: "3px",
              width: "6px",
              height: "6px",
              background: "rgba(20,20,20,0.9)",
              borderRadius: "999px",
              pointerEvents: "none",
            }}
          />
          {/* corner post bottom-right */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "3px",
              right: "3px",
              width: "6px",
              height: "6px",
              background: "rgba(20,20,20,0.9)",
              borderRadius: "999px",
              pointerEvents: "none",
            }}
          />
        </>
      );
    case "karate":
      return (
        <>
          {/* Blue competition frame with inner pink area */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", inset: "15%", background: "#1564bf", pointerEvents: "none" }}
          >
            <div
              aria-hidden="true"
              style={{ position: "absolute", inset: "20%", background: "#e8919f", pointerEvents: "none" }}
            >
              {/* contestant position marks — horizontal top */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "28%",
                  left: "38%",
                  right: "38%",
                  height: "2px",
                  background: "#1564bf",
                  pointerEvents: "none",
                }}
              />
              {/* contestant position marks — left vertical */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "36%",
                  bottom: "22%",
                  left: "41%",
                  width: "2px",
                  background: "#1564bf",
                  pointerEvents: "none",
                }}
              />
              {/* contestant position marks — right vertical */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "36%",
                  bottom: "22%",
                  right: "41%",
                  width: "2px",
                  background: "#1564bf",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
          {/* diagonal dashes in outer pink corners */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8%",
              left: "2%",
              width: "11%",
              height: "0",
              borderTop: "2px dashed #1564bf",
              transform: "rotate(-45deg)",
              transformOrigin: "right center",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8%",
              right: "2%",
              width: "11%",
              height: "0",
              borderTop: "2px dashed #1564bf",
              transform: "rotate(45deg)",
              transformOrigin: "left center",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "8%",
              left: "2%",
              width: "11%",
              height: "0",
              borderTop: "2px dashed #1564bf",
              transform: "rotate(45deg)",
              transformOrigin: "right center",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: "8%",
              right: "2%",
              width: "11%",
              height: "0",
              borderTop: "2px dashed #1564bf",
              transform: "rotate(-45deg)",
              transformOrigin: "left center",
              pointerEvents: "none",
            }}
          />
        </>
      );
    case "swimming":
      return (
        <>
          {/* pool border */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "4px",
              border: "2px solid rgba(255,255,255,0.7)",
              borderRadius: "2px",
              pointerEvents: "none",
            }}
          />
          {/* lane rope between lane 1 and 2 */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "calc(33.33% - 3px)",
              left: "4px",
              right: "4px",
              height: "6px",
              borderRadius: "3px",
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.92) 0px, rgba(255,255,255,0.92) 6px, transparent 6px, transparent 8px, rgba(210,40,40,0.9) 8px, rgba(210,40,40,0.9) 14px, transparent 14px, transparent 16px)",
              pointerEvents: "none",
            }}
          />
          {/* lane rope between lane 2 and 3 */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "calc(66.66% - 3px)",
              left: "4px",
              right: "4px",
              height: "6px",
              borderRadius: "3px",
              background:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.92) 0px, rgba(255,255,255,0.92) 6px, transparent 6px, transparent 8px, rgba(210,40,40,0.9) 8px, rgba(210,40,40,0.9) 14px, transparent 14px, transparent 16px)",
              pointerEvents: "none",
            }}
          />
          {/* turn wall line (left) */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "4px",
              bottom: "4px",
              left: "10%",
              width: "1px",
              background: "rgba(255,255,255,0.45)",
              pointerEvents: "none",
            }}
          />
          {/* turn wall line (right) */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "4px",
              bottom: "4px",
              right: "10%",
              width: "1px",
              background: "rgba(255,255,255,0.45)",
              pointerEvents: "none",
            }}
          />
        </>
      );
    default:
      return (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "8px",
              border: "1px solid rgba(255,255,255,0.72)",
              borderRadius: "4px",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "8px",
              bottom: "8px",
              left: "50%",
              width: "1px",
              background: "rgba(255,255,255,0.72)",
              transform: "translateX(-0.5px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "26px",
              height: "26px",
              border: "1px solid rgba(255,255,255,0.72)",
              borderRadius: "999px",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "4px",
              height: "4px",
              background: "rgba(255,255,255,0.8)",
              borderRadius: "999px",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        </>
      );
  }
}
