using OregonProviderFinder.Core.Nppes;
using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Api.Search;

public static class CriteriaParser
{
    public static ProviderCriteria Parse(
        string? q,
        string? groups,
        string? specialties,
        string? credentials,
        string? preset,
        string? near,
        int? radius,
        string? sex,
        string? sort,
        int? page,
        int? pageSize,
        double? minLat = null,
        double? minLng = null,
        double? maxLat = null,
        double? maxLng = null)
    {
        if (page is < 1)
        {
            throw new SearchRejectedException("Page starts at 1.");
        }

        if (q is { Length: > 200 })
        {
            throw new SearchRejectedException("Search text is limited to 200 characters.");
        }

        if (near is { Length: > 80 })
        {
            throw new SearchRejectedException("City or ZIP is limited to 80 characters.");
        }

        if (groups is { Length: > 200 } || specialties is { Length: > 400 } || credentials is { Length: > 200 })
        {
            throw new SearchRejectedException("Too many filters.");
        }

        if (page is > 200)
        {
            throw new SearchRejectedException("Page is limited to 200.");
        }

        var groupKeys = Split(groups);
        foreach (var key in groupKeys)
        {
            if (TaxonomyGroups.All.All(item => item.Key != key))
            {
                throw new SearchRejectedException("Unknown provider group.");
            }
        }

        var codes = Split(specialties).Select(code => code.ToUpperInvariant()).ToArray();
        if (codes.Any(code => code.Length != 10 || code.Any(ch => !char.IsLetterOrDigit(ch))))
        {
            throw new SearchRejectedException("Specialty codes are 10 letters or digits.");
        }

        var tokens = Split(credentials).Select(token => token.ToUpperInvariant()).ToArray();
        if (tokens.Any(token => !CredentialTokenizer.IsKnown(token)))
        {
            throw new SearchRejectedException("Unknown credential.");
        }

        CarePreset? care = null;
        if (!string.IsNullOrWhiteSpace(preset))
        {
            care = CarePresets.Find(preset) ?? throw new SearchRejectedException("Unknown care preset.");
        }

        var sexCode = string.IsNullOrWhiteSpace(sex) ? null : sex.Trim().ToUpperInvariant();
        if (sexCode is not (null or "F" or "M"))
        {
            throw new SearchRejectedException("Sex must be F or M.");
        }

        var sortKey = string.IsNullOrWhiteSpace(sort) ? "name" : sort.Trim().ToLowerInvariant();
        if (sortKey is not ("name" or "distance" or "relevance"))
        {
            throw new SearchRejectedException("Sort must be distance, name, or relevance.");
        }

        if (sortKey == "distance" && string.IsNullOrWhiteSpace(near))
        {
            throw new SearchRejectedException("Distance sort needs a city or ZIP.");
        }

        var size = Math.Clamp(pageSize ?? 20, 1, 50);
        var bounds = ReadBounds(minLat, minLng, maxLat, maxLng);
        return new ProviderCriteria(
            string.IsNullOrWhiteSpace(q) ? null : q.Trim(),
            groupKeys,
            codes,
            tokens,
            care,
            string.IsNullOrWhiteSpace(near) ? null : near.Trim(),
            Math.Clamp(radius ?? 25, 1, 100),
            sexCode,
            sortKey,
            page ?? 1,
            size,
            bounds);
    }

    private static MapBounds? ReadBounds(double? minLat, double? minLng, double? maxLat, double? maxLng)
    {
        var edges = new[] { minLat, minLng, maxLat, maxLng };
        if (edges.All(edge => edge is null))
        {
            return null;
        }

        if (edges.Any(edge => edge is null))
        {
            throw new SearchRejectedException("A map area needs all four edges.");
        }

        if (edges.Any(edge => edge is not { } value || !double.IsFinite(value)))
        {
            throw new SearchRejectedException("A map area needs real coordinates.");
        }

        if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180 || minLat > maxLat || minLng > maxLng)
        {
            throw new SearchRejectedException("That map area is not a valid box.");
        }

        return new MapBounds(minLat!.Value, minLng!.Value, maxLat!.Value, maxLng!.Value);
    }

    private static string[] Split(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
