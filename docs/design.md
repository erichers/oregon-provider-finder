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

## Map tiles

The map uses OpenStreetMap's standard tile server and shows the OSM attribution. The usage policy is https://operations.osmfoundation.org/policies/tiles/. This is a light, local directory, not a tile scraper. Markers are ZIP centers, and the page says so.
