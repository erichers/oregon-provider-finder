using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using CsvHelper;
using CsvHelper.Configuration;
using Npgsql;
using NpgsqlTypes;
using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Importer;

static class FullImport
{
    public static async Task RunAsync(string connectionString, string repo, string zipPath)
    {
        var clock = Stopwatch.StartNew();
        await GeoImport.LoadAsync(connectionString, repo);
        await TaxonomyImport.LoadAsync(connectionString, repo);

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        var startedAt = await ImportSwap.NowAsync(conn);
        var zips = await ImportSwap.LoadZipsAsync(conn);
        var labels = await ImportSwap.LoadLabelsAsync(conn);
        await ImportSwap.PrepareStagingAsync(conn);

        var taxPath = Path.Combine(repo, ".work", "staging-taxonomies.csv");
        Directory.CreateDirectory(Path.GetDirectoryName(taxPath)!);
        string? entryName = null;
        long scanned = 0;
        long kept = 0;
        var groups = TaxonomyGroups.All.ToDictionary(group => group.Key, _ => 0L);

        await using (var taxFile = new StreamWriter(taxPath))
        using (var taxCsv = new CsvWriter(taxFile, CultureInfo.InvariantCulture))
        await using (var providers = await conn.BeginBinaryImportAsync(ProviderCopy))
        using (var archive = ZipFile.OpenRead(zipPath))
        {
            var entry = archive.Entries.First(item =>
                item.Name.StartsWith("npidata_pfile_", StringComparison.Ordinal)
                && item.Name.EndsWith(".csv", StringComparison.Ordinal)
                && !item.Name.Contains("fileheader", StringComparison.Ordinal));
            entryName = entry.Name;
            await using var stream = entry.Open();
            using var reader = new StreamReader(stream);
            using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
            {
                BadDataFound = null,
                MissingFieldFound = null,
            });
            await csv.ReadAsync();
            csv.ReadHeader();
            var col = NppesHeader.Read(csv);

            while (await csv.ReadAsync())
            {
                scanned++;
                if (scanned % 250_000 == 0)
                {
                    Console.WriteLine($"scanned {scanned:N0} kept {kept:N0} {clock.Elapsed:hh\\:mm\\:ss} rss {ImportSwap.RssMb()}MB");
                }

                var slots = col.Slots(csv);
                var fields = new NppesFields
                {
                    EntityType = csv.GetField(col.Entity),
                    LastName = csv.GetField(col.Last),
                    FirstName = csv.GetField(col.First),
                    MiddleName = csv.GetField(col.Middle),
                    Prefix = csv.GetField(col.Prefix),
                    Suffix = csv.GetField(col.Suffix),
                    CredentialText = csv.GetField(col.Credential),
                    State = csv.GetField(col.State),
                    DeactivationDate = csv.GetField(col.Deactivation),
                    ReactivationDate = csv.GetField(col.Reactivation),
                    Sex = csv.GetField(col.Sex),
                    PostalCode = csv.GetField(col.Postal),
                    Phone = csv.GetField(col.Phone),
                    Slots = slots,
                };
                if (!ProviderFilter.TryKeep(fields, out var groupKeys))
                {
                    continue;
                }

                kept++;
                foreach (var key in groupKeys)
                {
                    groups[key]++;
                }

                var npi = (csv.GetField(col.Npi) ?? "").Trim();
                var zip5 = ProviderFilter.Zip5(fields.PostalCode);
                double? lat = null;
                double? lng = null;
                var precision = "None";
                if (zip5 is not null && zips.TryGetValue(zip5, out var point))
                {
                    lat = point.Lat;
                    lng = point.Lng;
                    precision = "Zip";
                }

                var specialty = string.Join(' ', slots
                    .Select(slot => labels.TryGetValue(slot.Code, out var label) ? label : null)
                    .Where(label => !string.IsNullOrWhiteSpace(label))
                    .Distinct(StringComparer.Ordinal));
                var primary = slots.FirstOrDefault(slot => slot.IsPrimary)?.Code
                    ?? slots.FirstOrDefault(slot => TaxonomyGroups.GroupFor(slot.Code) is not null)?.Code
                    ?? slots.FirstOrDefault()?.Code;

                await providers.StartRowAsync();
                await providers.WriteAsync(npi, NpgsqlDbType.Text);
                await TaxonomyImport.WriteText(providers, Blank(fields.FirstName));
                await TaxonomyImport.WriteText(providers, Blank(fields.MiddleName));
                await providers.WriteAsync(fields.LastName!.Trim(), NpgsqlDbType.Text);
                await TaxonomyImport.WriteText(providers, Blank(fields.Prefix));
                await TaxonomyImport.WriteText(providers, Blank(fields.Suffix));
                await providers.WriteAsync(ProviderFilter.FullName(fields.Prefix, fields.FirstName, fields.MiddleName, fields.LastName, fields.Suffix), NpgsqlDbType.Text);
                await TaxonomyImport.WriteText(providers, Blank(fields.CredentialText));
                await providers.WriteAsync(CredentialTokenizer.Tokenize(fields.CredentialText), NpgsqlDbType.Array | NpgsqlDbType.Text);
                await TaxonomyImport.WriteText(providers, ProviderFilter.Sex(fields.Sex));
                await TaxonomyImport.WriteText(providers, Blank(csv.GetField(col.Address1)));
                await TaxonomyImport.WriteText(providers, Blank(csv.GetField(col.Address2)));
                await TaxonomyImport.WriteText(providers, Blank(csv.GetField(col.City)));
                await TaxonomyImport.WriteText(providers, zip5);
                await TaxonomyImport.WriteText(providers, ProviderFilter.Phone(fields.Phone));
                await WriteDouble(providers, lat);
                await WriteDouble(providers, lng);
                await providers.WriteAsync(precision, NpgsqlDbType.Text);
                await providers.WriteAsync(groupKeys, NpgsqlDbType.Array | NpgsqlDbType.Text);
                await TaxonomyImport.WriteText(providers, primary);
                await providers.WriteAsync(specialty, NpgsqlDbType.Text);
                await WriteDate(providers, ProviderFilter.Date(csv.GetField(col.Enumeration)));
                await WriteDate(providers, ProviderFilter.Date(csv.GetField(col.Updated)));

                foreach (var slot in slots)
                {
                    taxCsv.WriteField(npi);
                    taxCsv.WriteField(slot.Code);
                    taxCsv.WriteField(slot.IsPrimary);
                    taxCsv.WriteField(slot.LicenseNumber?.Trim());
                    taxCsv.WriteField(slot.LicenseState?.Trim());
                    await taxCsv.NextRecordAsync();
                }
            }

            await providers.CompleteAsync();
        }

        await CopyTaxonomiesAsync(conn, taxPath);
        await ImportSwap.CommitAsync(conn, entryName, ImportSwap.AsOf(entryName), startedAt, scanned, kept);
        Console.WriteLine($"scanned {scanned:N0} kept {kept:N0} {clock.Elapsed:hh\\:mm\\:ss} rss {ImportSwap.RssMb()}MB");
        foreach (var pair in groups)
        {
            Console.WriteLine($"group {pair.Key} {pair.Value}");
        }
    }

    private const string ProviderCopy = """
        COPY staging_providers (
          npi, first_name, middle_name, last_name, prefix, suffix, full_name, credential_text,
          credentials, sex, address_line1, address_line2, city, zip5, phone, lat, lng,
          location_precision, group_keys, primary_taxonomy_code, specialty_labels,
          enumeration_date, registry_last_updated
        ) FROM STDIN (FORMAT BINARY)
        """;

    private static async Task CopyTaxonomiesAsync(NpgsqlConnection conn, string taxPath)
    {
        using var textImport = conn.BeginTextImport(
            "COPY staging_taxonomies (npi, code, is_primary, license_number, license_state) FROM STDIN (FORMAT CSV)");
        using var taxReader = new StreamReader(taxPath);
        while (await taxReader.ReadLineAsync() is { } line)
        {
            await textImport.WriteLineAsync(line);
        }
    }

    private static async Task WriteDouble(NpgsqlBinaryImporter writer, double? value)
    {
        if (value is null)
        {
            await writer.WriteNullAsync();
        }
        else
        {
            await writer.WriteAsync(value.Value, NpgsqlDbType.Double);
        }
    }

    private static async Task WriteDate(NpgsqlBinaryImporter writer, DateOnly? value)
    {
        if (value is null)
        {
            await writer.WriteNullAsync();
        }
        else
        {
            await writer.WriteAsync(value.Value, NpgsqlDbType.Date);
        }
    }

    private static string? Blank(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
