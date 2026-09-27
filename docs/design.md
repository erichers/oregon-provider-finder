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

The wordmark is the only large title. A result card is a name in Source Serif 4, then the credential, the specialty, and a muted place line. The profile puts specialties and the practice address in separate panels. Spacing uses a 0.25rem step: 0.5, 0.75, 1, and 1.5 rem.

Active filters sit above the count as chips. Each chip removes that one filter. Reset clears the search. While results load, flat skeleton bars stand in for the cards. An empty list offers a wider radius or dropping a specialty. An error offers Retry and Start over.

## Map tiles

The map uses OpenStreetMap's standard tile server and shows the OSM attribution. The usage policy is https://operations.osmfoundation.org/policies/tiles/. This is a light, local directory, not a tile scraper. Each marker is a provider at a ZIP center, and the page says so. People who share a center are grouped until that group is opened.

A Playwright check with axe runs against the home page, a result list, and a profile, and fails the build on a serious or critical violation.
