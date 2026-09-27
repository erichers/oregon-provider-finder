using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Api.Search;
using OregonProviderFinder.Core.Data;
using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Api.Controllers;

[ApiController]
public sealed class CatalogController(AppDbContext db, ChainStatusStore chain, IMemoryCache cache) : ControllerBase
{
    [HttpGet("api/facets")]
    [OutputCache(PolicyName = "facets")]
    public async Task<IActionResult> Facets([FromQuery] string? groups, CancellationToken cancellationToken)
    {
        var selected = string.IsNullOrWhiteSpace(groups)
            ? []
            : groups.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (selected.Any(key => TaxonomyGroups.All.All(item => item.Key != key)))
        {
            return Problem(detail: "Unknown provider group.", statusCode: StatusCodes.Status400BadRequest);
        }

        var groupCounts = new List<object>();
        foreach (var group in TaxonomyGroups.All)
        {
            var count = await db.Providers.CountAsync(p => p.GroupKeys.Contains(group.Key), cancellationToken);
            groupCounts.Add(new { key = group.Key, label = group.Label, count });
        }

        var specialtyQuery = db.ProviderTaxonomies.AsNoTracking();
        if (selected.Length > 0)
        {
            specialtyQuery = specialtyQuery.Where(t =>
                db.Providers.Any(p => p.Npi == t.Npi && selected.Any(key => p.GroupKeys.Contains(key))));
        }

        var specialties = await specialtyQuery
            .GroupBy(t => t.Code)
            .Select(g => new { code = g.Key, count = g.Count() })
            .OrderByDescending(item => item.count)
            .Take(80)
            .ToListAsync(cancellationToken);
        var labels = await db.Taxonomies.AsNoTracking().ToDictionaryAsync(t => t.Code, t => t.DisplayName, cancellationToken);
        var specialtyRows = specialties.Select(item => new
        {
            item.code,
            label = labels.GetValueOrDefault(item.code) ?? item.code,
            item.count,
        })
        .Where(item => !string.Equals(item.label, item.code, StringComparison.OrdinalIgnoreCase))
        .Take(40);

        var credentialArrays = await db.Providers.AsNoTracking().Select(p => p.Credentials).ToListAsync(cancellationToken);
        var credentials = credentialArrays
            .SelectMany(tokens => tokens)
            .GroupBy(token => token)
            .Select(g => new { token = g.Key, count = g.Count() })
            .OrderByDescending(item => item.count)
            .Take(20)
            .ToList();

        return Ok(new { groups = groupCounts, specialties = specialtyRows, credentials });
    }

    [HttpGet("api/locations")]
    public async Task<IActionResult> Locations([FromQuery] string? q, CancellationToken cancellationToken)
    {
        var clean = new string((q ?? "").Where(ch => char.IsLetterOrDigit(ch) || ch is ' ' or '-' or '\'').Take(40).ToArray()).Trim();
        if (clean.Length == 0)
        {
            return Ok(Array.Empty<object>());
        }

        var items = new List<object>();
        if (clean.All(char.IsDigit))
        {
            var zips = await db.ZipCentroids.AsNoTracking()
                .Where(z => EF.Functions.ILike(z.Zip5, clean + "%"))
                .OrderBy(z => z.Zip5)
                .Take(8)
                .Select(z => new { kind = "zip", label = z.Zip5.Trim(), value = z.Zip5.Trim() })
                .ToListAsync(cancellationToken);
            items.AddRange(zips);
        }

        if (items.Count < 8)
        {
            var cities = await db.Cities.AsNoTracking()
                .Where(c => c.ProviderCount >= 3 && EF.Functions.ILike(c.DisplayName, clean + "%"))
                .OrderByDescending(c => c.ProviderCount)
                .Take(8 - items.Count)
                .Select(c => new { kind = "city", label = c.DisplayName, value = c.DisplayName })
                .ToListAsync(cancellationToken);
            items.AddRange(cities);
        }

        return Ok(items);
    }

    [HttpGet("api/meta")]
    public async Task<IActionResult> Meta(CancellationToken cancellationToken)
    {
        var snapshot = await cache.GetOrCreateAsync("meta-db", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            var run = await db.ImportRuns.AsNoTracking()
                .OrderByDescending(item => item.Id)
                .Select(item => new
                {
                    item.Kind,
                    item.SourceName,
                    item.DataAsOf,
                    item.FinishedAt,
                    item.RowsKept,
                    item.Status,
                })
                .FirstOrDefaultAsync(cancellationToken);
            var providers = await db.Providers.CountAsync(cancellationToken);
            return new { dataAsOf = run?.DataAsOf, providerCount = providers, lastImport = run };
        });
        return Ok(new
        {
            snapshot?.dataAsOf,
            snapshot?.providerCount,
            snapshot?.lastImport,
            sources = new[]
            {
                new { name = "NPPES", url = "https://download.cms.gov/nppes/NPI_Files.html" },
                new { name = "NUCC taxonomy", url = "https://www.nucc.org" },
                new { name = "Census Gazetteer", url = "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html" },
            },
            chain = chain.Snapshot(),
        });
    }
}
