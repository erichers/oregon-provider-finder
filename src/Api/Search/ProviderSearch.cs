using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Core.Data;
using OregonProviderFinder.Core.Entities;
using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Api.Search;

public sealed class ProviderSearch(AppDbContext db)
{
    public async Task<SearchResponse> SearchAsync(ProviderCriteria criteria, CancellationToken cancellationToken)
    {
        var (query, center) = await FilterAsync(criteria, cancellationToken);
        var total = await query.CountAsync(cancellationToken);
        var ordered = Order(query, criteria, center);
        var rows = await ordered
            .Skip((criteria.Page - 1) * criteria.PageSize)
            .Take(criteria.PageSize)
            .Select(p => new Row(
                p.Npi, p.FullName, p.CredentialText, p.PrimaryTaxonomyCode, p.GroupKeys,
                p.City, p.Zip5, p.Phone, p.Lat, p.Lng, p.LocationPrecision, p.LastName))
            .ToListAsync(cancellationToken);
        var labels = await LabelsAsync(cancellationToken);
        var items = rows.Select(row => ToSummary(row, labels, center)).ToList();
        return new SearchResponse(total, criteria.Page, criteria.PageSize, center, items);
    }

    public async Task<IReadOnlyList<MapPoint>> MapAsync(ProviderCriteria criteria, CancellationToken cancellationToken)
    {
        var (query, _) = await FilterAsync(criteria, cancellationToken);
        var rows = await query
            .Where(p => p.Zip5 != null && p.Lat != null && p.Lng != null)
            .GroupBy(p => p.Zip5)
            .Select(g => new
            {
                Zip = g.Key,
                Lat = g.Average(p => p.Lat),
                Lng = g.Average(p => p.Lng),
                Count = g.Count(),
            })
            .ToListAsync(cancellationToken);
        return rows
            .Where(row => row.Zip != null && row.Lat != null && row.Lng != null)
            .Select(row => new MapPoint(row.Zip!.Trim(), row.Lat ?? 0, row.Lng ?? 0, row.Count))
            .ToList();
    }

    public async Task<ProviderDetail?> DetailAsync(string npi, CancellationToken cancellationToken)
    {
        var provider = await db.Providers.AsNoTracking()
            .Include(p => p.Taxonomies)
            .FirstOrDefaultAsync(p => p.Npi == npi, cancellationToken);
        if (provider is null)
        {
            return null;
        }

        var labels = await LabelsAsync(cancellationToken);
        var taxonomies = provider.Taxonomies
            .OrderByDescending(item => item.IsPrimary)
            .ThenBy(item => item.Code)
            .Select(item => new TaxonomyItem(
                item.Code,
                labels.GetValueOrDefault(item.Code),
                item.IsPrimary,
                item.LicenseNumber,
                item.LicenseState))
            .ToList();
        return new ProviderDetail(
            provider.Npi.Trim(),
            provider.FullName,
            provider.CredentialText,
            provider.Credentials,
            provider.Sex,
            provider.AddressLine1,
            provider.AddressLine2,
            provider.City,
            provider.Zip5?.Trim(),
            provider.Phone,
            provider.Lat,
            provider.Lng,
            provider.LocationPrecision,
            provider.GroupKeys,
            provider.PrimaryTaxonomyCode is null ? null : labels.GetValueOrDefault(provider.PrimaryTaxonomyCode),
            provider.PrimaryTaxonomyCode,
            provider.EnumerationDate,
            provider.RegistryLastUpdated,
            "https://npiregistry.cms.hhs.gov/provider-view/" + provider.Npi.Trim(),
            taxonomies);
    }

    private async Task<(IQueryable<Provider> Query, PlaceCenter? Center)> FilterAsync(ProviderCriteria criteria, CancellationToken cancellationToken)
    {
        IQueryable<Provider> query = db.Providers.AsNoTracking();
        PlaceCenter? center = null;
        if (!string.IsNullOrWhiteSpace(criteria.Near))
        {
            var place = await PlaceResolver.FindAsync(db, criteria.Near, cancellationToken);
            if (place is null)
            {
                throw new SearchRejectedException("No Oregon city or ZIP matched that place.");
            }

            center = new PlaceCenter(place.Lat, place.Lng, place.Label);
            var radius = Math.Clamp(criteria.Radius, 1, 100);
            var latPad = radius / 69.0;
            var cosine = Math.Cos(place.Lat * Math.PI / 180.0);
            var lngPad = Math.Abs(cosine) < 0.01 ? radius / 69.0 : radius / (69.0 * cosine);
            var south = place.Lat - latPad;
            var north = place.Lat + latPad;
            var west = place.Lng - lngPad;
            var east = place.Lng + lngPad;
            query = query.Where(p =>
                p.Lat != null && p.Lng != null
                && p.Lat >= south && p.Lat <= north
                && p.Lng >= west && p.Lng <= east
                && AppDbContext.MilesBetween(place.Lat, place.Lng, p.Lat ?? 0, p.Lng ?? 0) <= radius);
        }

        if (criteria.Preset is not null)
        {
            var groups = criteria.Preset.Groups;
            var codes = criteria.Preset.Codes;
            var credentials = criteria.Preset.Credentials;
            query = query.Where(p =>
                (groups.Length > 0 && groups.Any(g => p.GroupKeys.Contains(g)))
                || (codes.Length > 0 && p.Taxonomies.Any(t => codes.Contains(t.Code)))
                || (credentials.Length > 0 && credentials.Any(c => p.Credentials.Contains(c))));
        }

        if (criteria.Groups.Length > 0)
        {
            var groups = criteria.Groups;
            query = query.Where(p => groups.Any(g => p.GroupKeys.Contains(g)));
        }

        if (criteria.Specialties.Length > 0)
        {
            var codes = criteria.Specialties;
            query = query.Where(p => p.Taxonomies.Any(t => codes.Contains(t.Code)));
        }

        if (criteria.Credentials.Length > 0)
        {
            var credentials = criteria.Credentials;
            query = query.Where(p => credentials.Any(c => p.Credentials.Contains(c)));
        }

        if (criteria.Sex is not null)
        {
            query = query.Where(p => p.Sex == criteria.Sex);
        }

        if (!string.IsNullOrWhiteSpace(criteria.Q))
        {
            var q = criteria.Q;
            query = query.Where(p => p.SearchVector.Matches(EF.Functions.WebSearchToTsQuery("english", q)));
        }

        return (query, center);
    }

    private static IOrderedQueryable<Provider> Order(IQueryable<Provider> query, ProviderCriteria criteria, PlaceCenter? center)
    {
        if (criteria.Sort == "distance" && center is not null)
        {
            return query
                .OrderBy(p => AppDbContext.MilesBetween(center.Lat, center.Lng, p.Lat ?? 0, p.Lng ?? 0))
                .ThenBy(p => p.Npi);
        }

        if (criteria.Sort == "relevance" && !string.IsNullOrWhiteSpace(criteria.Q))
        {
            var q = criteria.Q;
            return query
                .OrderByDescending(p => p.SearchVector.Rank(EF.Functions.WebSearchToTsQuery("english", q)))
                .ThenBy(p => p.Npi);
        }

        return query.OrderBy(p => p.LastName).ThenBy(p => p.FirstName).ThenBy(p => p.Npi);
    }

    private async Task<Dictionary<string, string>> LabelsAsync(CancellationToken cancellationToken)
        => await db.Taxonomies.AsNoTracking().ToDictionaryAsync(t => t.Code, t => t.DisplayName, cancellationToken);

    private static ProviderSummary ToSummary(Row row, Dictionary<string, string> labels, PlaceCenter? center)
    {
        double? miles = null;
        if (center is not null && row.Lat is not null && row.Lng is not null)
        {
            miles = Math.Round(Haversine(center.Lat, center.Lng, row.Lat.Value, row.Lng.Value), 1);
        }

        var specialty = row.PrimaryTaxonomyCode is null ? null : labels.GetValueOrDefault(row.PrimaryTaxonomyCode);
        return new ProviderSummary(
            row.Npi.Trim(),
            row.FullName,
            row.CredentialText,
            specialty,
            row.Groups,
            row.City,
            row.Zip5?.Trim(),
            row.Phone,
            miles,
            row.LocationPrecision);
    }

    private static double Haversine(double lat1, double lng1, double lat2, double lng2)
    {
        const double earth = 3958.8;
        var dLat = (lat2 - lat1) * Math.PI / 180.0;
        var dLng = (lng2 - lng1) * Math.PI / 180.0;
        var a = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0) * Math.Pow(Math.Sin(dLng / 2), 2);
        return earth * 2 * Math.Asin(Math.Sqrt(a));
    }

    private sealed record Row(
        string Npi,
        string FullName,
        string? CredentialText,
        string? PrimaryTaxonomyCode,
        string[] Groups,
        string? City,
        string? Zip5,
        string? Phone,
        double? Lat,
        double? Lng,
        string LocationPrecision,
        string LastName);
}

public sealed record ProviderCriteria(
    string? Q,
    string[] Groups,
    string[] Specialties,
    string[] Credentials,
    CarePreset? Preset,
    string? Near,
    int Radius,
    string? Sex,
    string Sort,
    int Page,
    int PageSize);
