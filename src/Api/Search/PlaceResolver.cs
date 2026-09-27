using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Core.Data;

namespace OregonProviderFinder.Api.Search;

public sealed record ResolvedPlace(string Label, double Lat, double Lng);

public static class PlaceResolver
{
    public static async Task<ResolvedPlace?> FindAsync(AppDbContext db, string raw, CancellationToken cancellationToken)
    {
        var text = raw.Trim();
        if (text.Length == 0)
        {
            return null;
        }

        if (text.Length >= 5 && text[..5].All(char.IsDigit))
        {
            var zip = text[..5];
            var row = await db.ZipCentroids.AsNoTracking().FirstOrDefaultAsync(item => item.Zip5 == zip, cancellationToken);
            return row is null ? null : new ResolvedPlace(zip, row.Lat, row.Lng);
        }

        var name = Normalize(text);
        var city = await db.Cities.AsNoTracking().FirstOrDefaultAsync(item => item.Name == name, cancellationToken);
        if (city is not null)
        {
            return new ResolvedPlace(city.DisplayName, city.Lat, city.Lng);
        }

        city = await db.Cities.AsNoTracking()
            .Where(item => EF.Functions.ILike(item.DisplayName, name + "%"))
            .OrderByDescending(item => item.ProviderCount)
            .FirstOrDefaultAsync(cancellationToken);
        return city is null ? null : new ResolvedPlace(city.DisplayName, city.Lat, city.Lng);
    }

    public static string Normalize(string value)
        => ExtraSpace.Replace(value.Trim().ToLowerInvariant(), " ");

    private static readonly Regex ExtraSpace = new(@"\s+", RegexOptions.Compiled);
}
