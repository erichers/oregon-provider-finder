# Design

Public Sans for the interface, Source Serif 4 for the wordmark and provider names. Public Sans is the US Web Design System face for government services, and this directory is built on a federal registry. Source Serif 4 is used only for names and titles.

No dark theme.

## Contrast

Measured as WCAG relative luminance, text on its background. The floor for body text is 4.5:1.

| Pair | Ratio |
| --- | --- |
| Ink `#1F2421` on paper `#F4F5F2` | 14.40 |
| Muted `#5B635D` on paper | 5.66 |
| Fir `#2F5D46` on paper | 6.92 |
| Fir on surface `#FFFFFF` | 7.57 |
| White on fir | 7.57 |
| White on fir-deep `#234836` | 10.24 |
| Ink on surface | 15.76 |
| Muted on surface | 6.20 |

Ochre `#C98B2B` is used for focus rings, selected chip borders, and map markers. It is not used as text on paper.

Focus is a 3px ochre outline, offset 3px, with a 2px ink ring between the control and the outline.

## Hierarchy

The wordmark is the only large title. On the search page it sits in a slim bar with the crisis line, at 1rem, so the map can run to the edges. A result card is a name in Source Serif 4, then the credential, the specialty, and a muted place line with the distance. Cards use 16px of inner padding and about 12px between them. The profile puts specialties and the practice address in separate panels. Spacing uses a 4px step: 4, 8, 12, 16, 20, and 24. Those steps, the pill radius, the card radius, the bar shadow, and the 220ms motion time are custom properties on the page.

Active filters, Reset, and Filters sit in one scrolling row. Each chip removes that one filter. Reset clears the search. While results load, flat skeleton bars stand in for the cards. When motion is allowed, a new page and the result cards rise about 8 pixels and fade in over roughly 200 milliseconds. Reduced motion turns that off. An empty list offers a wider radius or dropping a specialty. An error offers Retry and Start over.

## Map

On the search page the map fills the window, edge to edge. A slim bar floats at the top. On a wide screen it holds the wordmark, the directory links, and the 988 line. On a phone it is one 48px line: OR Provider Finder, Crisis? Call or text 988, and a Menu button for Search, About the data, and GitHub. The search field is a pill under that bar. Filters, care needs, and active filters share one slim scrolling row with an 8px gap and 16px inset, the same inset as the count and the cards. A sideways row fades at the edge where more pills are hidden, and the drawer list hides its scrollbar. A phone chip is about 34px tall. The bar, the search pill, the chips, and the list header use a frosted glass: white at 84% opacity, a 12px blur, a white hairline, and a soft shadow. Cards and the preview use 90% white. Without backdrop blur, or when reduced transparency is on, that fill becomes 92% white. Sort, place, radius, and the other filters sit in a Filters panel. The phone zoom buttons sit at the lower right, just above the list, and they fade out once the sheet is above half height. The full sheet stops just below the chips so the count and the chevron stay visible. Clicking a cluster lists the providers at that node, for example "12 providers near Portland", and the list stays while the map moves. A card or a single marker opens a glass preview with a View full profile link. The drawer itself has no background: the search pill, each chip, the count row, and each card are separate glass pieces, with cards at 90% white so the type stays readable over the map. A drawer about 400 pixels wide sits on the left on a wide screen. A chevron button at the top of the list closes it to a small tab and opens it again. The arrow points left to close and right to open. On a phone the same button sits in a slim bar at the bottom, with the count. The arrow points up at the peek, and a tap opens the list to half. While the list is open the arrow points down, and a tap returns to the peek. Arrow keys step one stop at a time. Dragging that bar still moves the sheet. The preview closes with Escape, its close button, or a click outside, and focus returns to the card or marker that opened it. The list column still scrolls. Reduced motion turns the slide, the rise, and the pin pop off.

Tiles come from the OpenStreetMap tile server. The page shows the OSM attribution. The usage policy is https://operations.osmfoundation.org/policies/tiles/. CARTO's raster CDN now requires a key, so it is not used. No key is required. Each marker is a provider at a ZIP center, and the drawer says so. Nearby markers cluster, and the cluster splits when it is opened.

A Playwright check with axe runs against the home page, a result list, and a profile, and fails the build on a serious or critical violation.
