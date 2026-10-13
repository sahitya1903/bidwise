# UML diagrams

PlantUML sources for the five design diagrams. They match the code in `server/src`.

| File | Diagram |
|---|---|
| [use-case.puml](use-case.puml) | Figure 1 — Use cases (UC-01 … UC-12) |
| [architecture.puml](architecture.puml) | Figure 2 — Layered architecture and where tests plug in |
| [class.puml](class.puml) | Figure 3 — Domain classes and service layer |
| [state.puml](state.puml) | Figure 4 — Auction lifecycle |
| [sequence-place-bid.puml](sequence-place-bid.puml) | Figure 5 — Place bid, including the race-condition path |

To export PNGs for the slides, use one of:

- VS Code extension **PlantUML** (jebbs.plantuml): open a file, then "PlantUML: Export Current Diagram".
- `java -jar plantuml.jar -tpng docs/uml/*.puml` with the jar from plantuml.com.
- Paste the source into the online editor at plantuml.com.

The diagrams use `!pragma layout smetana`, so Graphviz is not required.
