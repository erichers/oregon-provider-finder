using System.IO.Compression;
using Npgsql;
using NpgsqlTypes;
using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Importer;

static class LocationImport
{
    public static async Task RunAsync(string connectionString, string zipPath)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        var npis = new HashSet<string>(StringComparer.Ordinal);
        await using (var load = new NpgsqlCommand("SELECT npi FROM providers", conn))
        await using (var rows = await load.ExecuteReaderAsync())
        {
            while (await rows.ReadAsync())
            {
                npis.Add(rows.GetString(0).Trim());
            }
        }

        await using (var clear = new NpgsqlCommand("TRUNCATE provider_locations RESTART IDENTITY", conn))
        {
            await clear.ExecuteNonQueryAsync();
        }

        long kept = 0;
        await using (var copy = await conn.BeginBinaryImportAsync(
            "COPY provider_locations (npi, address_line1, address_line2, city, state, postal_code, phone) FROM STDIN (FORMAT BINARY)"))
        using (var archive = ZipFile.OpenRead(zipPath))
        {
            var entry = archive.Entries.First(item => item.Name.StartsWith("pl_pfile_", StringComparison.Ordinal) && item.Name.EndsWith(".csv", StringComparison.Ordinal));
            await using var stream = entry.Open();
            using var reader = new StreamReader(stream);
            foreach (var place in SecondaryLocationParser.Read(reader))
            {
                if (!npis.Contains(place.Npi))
                {
                    continue;
                }

                await copy.StartRowAsync();
                await copy.WriteAsync(place.Npi, NpgsqlDbType.Char);
                await copy.WriteAsync(place.AddressLine1, NpgsqlDbType.Text);
                await copy.WriteAsync(place.AddressLine2, NpgsqlDbType.Text);
                await copy.WriteAsync(place.City, NpgsqlDbType.Text);
                await copy.WriteAsync(place.State, NpgsqlDbType.Text);
                await copy.WriteAsync(place.PostalCode, NpgsqlDbType.Text);
                await copy.WriteAsync(place.Phone, NpgsqlDbType.Text);
                kept++;
            }

            await copy.CompleteAsync();
        }

        Console.WriteLine($"locations {kept}");
    }
}
