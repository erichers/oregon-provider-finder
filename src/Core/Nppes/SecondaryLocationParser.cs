using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;

namespace OregonProviderFinder.Core.Nppes;

public sealed record SecondaryLocation(
    string Npi,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? State,
    string? PostalCode,
    string? Phone);

public static class SecondaryLocationParser
{
    public static IEnumerable<SecondaryLocation> Read(TextReader reader)
    {
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            BadDataFound = null,
            MissingFieldFound = null,
        });
        if (!csv.Read() || !csv.ReadHeader() || csv.HeaderRecord is null)
        {
            yield break;
        }

        while (csv.Read())
        {
            var npi = csv.GetField("NPI")?.Trim();
            if (npi is not { Length: 10 })
            {
                continue;
            }

            var line1 = Blank(csv.GetField("Provider Secondary Practice Location Address- Address Line 1"));
            if (line1 is null)
            {
                continue;
            }

            yield return new SecondaryLocation(
                npi,
                line1,
                Blank(csv.GetField("Provider Secondary Practice Location Address-  Address Line 2")),
                Blank(csv.GetField("Provider Secondary Practice Location Address - City Name")),
                Blank(csv.GetField("Provider Secondary Practice Location Address - State Name")),
                Blank(csv.GetField("Provider Secondary Practice Location Address - Postal Code")),
                Blank(csv.GetField("Provider Secondary Practice Location Address - Telephone Number")));
        }
    }

    private static string? Blank(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
